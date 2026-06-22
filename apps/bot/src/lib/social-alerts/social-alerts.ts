import type { Message } from "discord.js";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import {
  Prisma,
  SocialAlertType,
  type SocialAlert,
  type SocialAlertDelivery
} from "@guildforge/database";
import {
  buildSocialAlertSourceUrl,
  formatTemplate,
  isSafePublicHttpUrl,
  socialAlertTypeLabels
} from "@guildforge/shared";

import type { CommandContext } from "../../commands/types";
import { env } from "../../env";
import { isSendableGuildTextChannel } from "../channels";
import { isGuildModuleEnabled } from "../modules";
import {
  parseBlueskyEntries,
  parseJsonFeedEntries,
  parseRedditEntries,
  parseXmlFeedEntries,
  type SocialAlertEntry
} from "./feed-parsers";

type SocialAlertResult =
  | "sent"
  | "baseline"
  | "unchanged"
  | "no-entry"
  | "rate-limited"
  | "skipped";

type SocialAlertCheckSummary = {
  checked: number;
  sent: number;
  baselined: number;
  unchanged: number;
  rateLimited: number;
  skipped: number;
  failed: number;
};

const localCheckTimestamps = new Map<string, number>();
let lastDeliveryPruneAt = 0;
let redditTokenCache: { token: string; expiresAt: number } | null = null;

class SourceRequestError extends Error {
  constructor(
    message: string,
    readonly retryAfterSeconds: number | null = null
  ) {
    super(message);
  }
}

function requestError(response: Response, label: string) {
  const retryAfter = response.headers.get("retry-after");
  let retryAfterSeconds: number | null = null;

  if (retryAfter) {
    const seconds = Number(retryAfter);
    const date = Date.parse(retryAfter);

    retryAfterSeconds = Number.isFinite(seconds)
      ? Math.max(1, seconds)
      : Number.isNaN(date)
        ? null
        : Math.max(1, Math.ceil((date - Date.now()) / 1_000));
  }

  return new SourceRequestError(
    `${label} failed with ${response.status}${retryAfter ? `; retry after ${retryAfter}` : ""}`,
    retryAfterSeconds
  );
}

function formatDiscordTimestamp(value: string | null) {
  if (!value) {
    return "";
  }

  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? "" : `<t:${Math.floor(timestamp / 1000)}:R>`;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  if (!isSafePublicHttpUrl(url)) {
    throw new Error("Source URL is not a safe public HTTP endpoint");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  let currentUrl = url;

  try {
    for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
      await assertPublicEndpoint(currentUrl);
      const response = await fetch(currentUrl, {
        ...init,
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "application/feed+json, application/json, application/atom+xml, application/rss+xml, application/xml, text/xml;q=0.9",
          "User-Agent": "Hydrava/0.1 Social Alerts",
          ...init.headers
        }
      });

      if (response.status < 300 || response.status >= 400) {
        return response;
      }

      const location = response.headers.get("location");

      if (!location) {
        return response;
      }

      const nextUrl = new URL(location, currentUrl);
      const requestHeaders = new Headers(init.headers);

      if (
        nextUrl.origin !== new URL(currentUrl).origin &&
        (requestHeaders.has("authorization") || requestHeaders.has("client-id"))
      ) {
        throw new Error("Authenticated source attempted a cross-origin redirect");
      }

      currentUrl = nextUrl.toString();
    }

    throw new Error("Source returned too many redirects");
  } finally {
    clearTimeout(timeout);
  }
}

function isPrivateAddress(address: string) {
  const normalized = address.toLocaleLowerCase();

  if (normalized.startsWith("::ffff:")) {
    return isPrivateAddress(normalized.slice("::ffff:".length));
  }

  if (normalized.includes(":")) {
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      /^fe[89ab]/.test(normalized)
    );
  }

  const parts = normalized.split(".").map(Number);

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return true;
  }

  const [first, second] = parts;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && (second === 0 || second === 168)) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}

async function assertPublicEndpoint(value: string) {
  if (!isSafePublicHttpUrl(value)) {
    throw new Error("Source redirect is not a safe public HTTP endpoint");
  }

  const url = new URL(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new Error("Source URL resolves to a private network address");
    }
    return;
  }

  const addresses = await lookup(hostname, {
    all: true,
    verbatim: true
  });

  if (addresses.length === 0 || addresses.some((result) => isPrivateAddress(result.address))) {
    throw new Error("Source hostname resolves to a private or unavailable address");
  }
}

async function fetchFeedEntries(alert: SocialAlert) {
  const sourceUrl = buildSocialAlertSourceUrl(alert.type, alert.sourceId, alert.sourceUrl);
  const response = await fetchWithTimeout(sourceUrl);

  if (!response.ok) {
    throw requestError(response, "Source request");
  }

  const body = await response.text();

  if (body.length > 5_000_000) {
    throw new Error("Source response is larger than 5 MB");
  }

  const contentType = response.headers.get("content-type")?.toLocaleLowerCase() ?? "";
  const looksLikeJson = contentType.includes("json") || body.trimStart().startsWith("{");

  if (!looksLikeJson) {
    return parseXmlFeedEntries(body);
  }

  let payload: unknown;

  try {
    payload = JSON.parse(body) as unknown;
  } catch {
    throw new Error("Source returned invalid JSON");
  }

  return alert.type === SocialAlertType.BLUESKY
    ? parseBlueskyEntries(payload)
    : parseJsonFeedEntries(payload, alert.sourceId);
}

type TwitchStreamsResponse = {
  data?: Array<{
    id?: string;
    title?: string;
    user_login?: string;
    user_name?: string;
    started_at?: string;
  }>;
};

async function fetchTwitchEntries(alert: SocialAlert): Promise<SocialAlertEntry[]> {
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_ACCESS_TOKEN) {
    throw new Error("Twitch credentials are not configured");
  }

  const response = await fetchWithTimeout(
    `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(alert.sourceId)}`,
    {
      headers: {
        Authorization: `Bearer ${env.TWITCH_ACCESS_TOKEN}`,
        "Client-Id": env.TWITCH_CLIENT_ID
      }
    }
  );

  if (!response.ok) {
    throw requestError(response, "Twitch request");
  }

  const data = (await response.json()) as TwitchStreamsResponse;
  const stream = data.data?.[0];

  if (!stream?.id) {
    return [];
  }

  return [
    {
      id: stream.id,
      title: stream.title ?? `${stream.user_name ?? alert.sourceId} 正在直播`,
      url: alert.sourceUrl || `https://www.twitch.tv/${stream.user_login ?? alert.sourceId}`,
      author: stream.user_name ?? alert.sourceId,
      publishedAt: stream.started_at ?? null
    }
  ];
}

type RedditTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

async function getRedditAccessToken() {
  if (redditTokenCache && redditTokenCache.expiresAt > Date.now() + 60_000) {
    return redditTokenCache.token;
  }

  if (!env.REDDIT_CLIENT_ID || !env.REDDIT_CLIENT_SECRET) {
    return null;
  }

  const credentials = Buffer.from(
    `${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`
  ).toString("base64");
  const response = await fetchWithTimeout("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": env.REDDIT_USER_AGENT ?? "Hydrava/0.1 Social Alerts"
    },
    body: new URLSearchParams({
      grant_type: "client_credentials"
    })
  });

  if (!response.ok) {
    throw requestError(response, "Reddit OAuth request");
  }

  const payload = (await response.json()) as RedditTokenResponse;

  if (!payload.access_token) {
    throw new Error("Reddit OAuth response did not include an access token");
  }

  redditTokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + Math.max(60, payload.expires_in ?? 3_600) * 1_000
  };
  return redditTokenCache.token;
}

function redditApiPath(sourceId: string) {
  const normalized = sourceId
    .replace(/^https?:\/\/(www\.)?reddit\.com\//i, "")
    .replace(/^\/+|\/+$/g, "");
  const userMatch = normalized.match(/^(?:u|user)\/(.+)$/i);

  return userMatch
    ? `/user/${userMatch[1]}/submitted`
    : `/${normalized.startsWith("r/") ? normalized : `r/${normalized}`}/new`;
}

async function fetchRedditEntries(alert: SocialAlert) {
  const customBridge = !/^https?:\/\/(www\.|old\.)?reddit\.com\//i.test(alert.sourceUrl);

  if (customBridge) {
    return fetchFeedEntries(alert);
  }

  const token = await getRedditAccessToken();

  if (!token) {
    throw new Error(
      "Reddit requires REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET, or a public feed bridge URL"
    );
  }

  const response = await fetchWithTimeout(
    `https://oauth.reddit.com${redditApiPath(alert.sourceId)}?limit=20&raw_json=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": env.REDDIT_USER_AGENT ?? "Hydrava/0.1 Social Alerts"
      }
    }
  );

  if (!response.ok) {
    throw requestError(response, "Reddit API request");
  }

  return parseRedditEntries((await response.json()) as unknown);
}

async function fetchLatestEntries(alert: SocialAlert) {
  if (alert.type === SocialAlertType.TWITCH) {
    return fetchTwitchEntries(alert);
  }

  if (alert.type === SocialAlertType.REDDIT) {
    return fetchRedditEntries(alert);
  }

  return fetchFeedEntries(alert);
}

async function shouldCheckAlert(context: CommandContext, alert: SocialAlert, force = false) {
  if (force) {
    return true;
  }

  const lockSeconds = Math.max(30, Math.min(alert.intervalSeconds, 300));

  if (context.redis) {
    const result = await context.redis.set(
      `social-alert:${alert.id}:processing`,
      String(Date.now()),
      "EX",
      lockSeconds,
      "NX"
    );

    if (result !== "OK") {
      return false;
    }
  } else {
    const now = Date.now();
    const lastCheckedAt = localCheckTimestamps.get(alert.id) ?? 0;

    if (now - lastCheckedAt < lockSeconds * 1_000) {
      return false;
    }

    localCheckTimestamps.set(alert.id, now);
  }

  const claimed = await context.prisma.socialAlert.updateMany({
    where: {
      id: alert.id,
      enabled: true,
      nextCheckAt: {
        lte: new Date()
      }
    },
    data: {
      nextCheckAt: new Date(Date.now() + alert.intervalSeconds * 1_000)
    }
  });

  return claimed.count === 1;
}

function mentionText(alert: SocialAlert) {
  if (alert.mentionEveryone) {
    return "@everyone ";
  }

  return alert.mentionRoleId ? `<@&${alert.mentionRoleId}> ` : "";
}

async function sendAlertMessage(
  context: CommandContext,
  alert: SocialAlert,
  entry: SocialAlertEntry,
  prefix = ""
): Promise<Message | null> {
  const guild =
    context.client.guilds.cache.get(alert.guildId) ??
    (await context.client.guilds.fetch(alert.guildId).catch(() => null));
  const channel = guild ? await guild.channels.fetch(alert.channelId).catch(() => null) : null;

  if (!guild || !isSendableGuildTextChannel(channel)) {
    return null;
  }

  const mention = mentionText(alert);
  const formatted = formatTemplate(alert.messageTemplate, {
    title: entry.title,
    url: entry.url,
    author: entry.author,
    source: alert.sourceId,
    type: socialAlertTypeLabels[alert.type],
    server: guild.name,
    publishedAt: formatDiscordTimestamp(entry.publishedAt),
    mention
  }).trim();
  const content = `${prefix}${alert.messageTemplate.includes("{mention}") ? "" : mention}${
    formatted || `${entry.title}\n${entry.url}`
  }`.slice(0, 2_000);

  return channel.send({
    content,
    allowedMentions: {
      parse: alert.mentionEveryone ? ["everyone"] : [],
      roles: alert.mentionRoleId ? [alert.mentionRoleId] : []
    }
  });
}

async function markHealthy(
  context: CommandContext,
  alert: SocialAlert,
  data: { lastSeenId?: string } = {}
) {
  await context.prisma.socialAlert.update({
    where: { id: alert.id },
    data: {
      ...data,
      consecutiveFailures: 0,
      lastError: null,
      lastErrorAt: null,
      lastSuccessAt: new Date(),
      nextCheckAt: new Date(Date.now() + alert.intervalSeconds * 1_000)
    }
  });
}

async function markFailed(context: CommandContext, alert: SocialAlert, error: unknown) {
  const failures = alert.consecutiveFailures + 1;
  const exponentialRetry = Math.min(
    21_600,
    Math.max(60, alert.intervalSeconds) * 2 ** Math.min(failures - 1, 6)
  );
  const retrySeconds =
    error instanceof SourceRequestError && error.retryAfterSeconds
      ? Math.min(86_400, Math.max(exponentialRetry, error.retryAfterSeconds))
      : exponentialRetry;

  await context.prisma.socialAlert.update({
    where: { id: alert.id },
    data: {
      consecutiveFailures: failures,
      lastError: (error instanceof Error ? error.message : "Unknown error").slice(0, 2_000),
      lastErrorAt: new Date(),
      nextCheckAt: new Date(Date.now() + retrySeconds * 1_000)
    }
  });
}

async function claimDelivery(
  context: CommandContext,
  alert: SocialAlert,
  entry: SocialAlertEntry
): Promise<{ delivery: SocialAlertDelivery | null; alreadySent: boolean }> {
  const existing = await context.prisma.socialAlertDelivery.findUnique({
    where: {
      alertId_externalItemId: {
        alertId: alert.id,
        externalItemId: entry.id
      }
    }
  });

  if (existing?.status === "SENT") {
    return { delivery: null, alreadySent: true };
  }

  if (
    existing?.status === "PENDING" &&
    Date.now() - existing.updatedAt.getTime() < 5 * 60_000
  ) {
    return { delivery: null, alreadySent: false };
  }

  if (existing) {
    return {
      delivery: await context.prisma.socialAlertDelivery.update({
        where: { id: existing.id },
        data: {
          status: "PENDING",
          attempts: { increment: 1 },
          error: null,
          itemUrl: entry.url
        }
      }),
      alreadySent: false
    };
  }

  try {
    return {
      delivery: await context.prisma.socialAlertDelivery.create({
        data: {
          guildId: alert.guildId,
          alertId: alert.id,
          externalItemId: entry.id,
          itemUrl: entry.url
        }
      }),
      alreadySent: false
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { delivery: null, alreadySent: false };
    }

    throw error;
  }
}

async function processSocialAlert(
  context: CommandContext,
  alert: SocialAlert
): Promise<SocialAlertResult> {
  if (!(await isGuildModuleEnabled(context.prisma, alert.guildId, "SOCIAL_ALERTS"))) {
    return "skipped";
  }

  const entries = await fetchLatestEntries(alert);

  if (entries.length === 0) {
    await markHealthy(context, alert);
    return "no-entry";
  }

  if (!alert.lastSeenId) {
    await markHealthy(context, alert, { lastSeenId: entries[0].id });
    return "baseline";
  }

  if (alert.lastSeenId === entries[0].id) {
    await markHealthy(context, alert);
    return "unchanged";
  }

  const previousIndex = entries.findIndex((entry) => entry.id === alert.lastSeenId);
  const pendingEntries = (
    previousIndex >= 0 ? entries.slice(0, previousIndex) : entries.slice(0, 1)
  )
    .reverse()
    .slice(0, alert.maxItemsPerCheck);
  const sentLastHour = await context.prisma.socialAlertDelivery.count({
    where: {
      alertId: alert.id,
      status: "SENT",
      deliveredAt: {
        gte: new Date(Date.now() - 60 * 60_000)
      }
    }
  });
  let remaining = Math.max(0, alert.maxNotificationsPerHour - sentLastHour);
  let sent = 0;
  let lastSeenId = alert.lastSeenId;
  let progressed = false;

  if (remaining === 0) {
    await markHealthy(context, alert);
    return "rate-limited";
  }

  for (const entry of pendingEntries) {
    if (remaining === 0) {
      break;
    }

    const claim = await claimDelivery(context, alert, entry);

    if (claim.alreadySent) {
      lastSeenId = entry.id;
      progressed = true;
      continue;
    }

    if (!claim.delivery) {
      continue;
    }

    try {
      const message = await sendAlertMessage(context, alert, entry);

      if (!message) {
        throw new Error("Alert channel was deleted or is not accessible");
      }

      await context.prisma.socialAlertDelivery.update({
        where: { id: claim.delivery.id },
        data: {
          status: "SENT",
          messageId: message.id,
          deliveredAt: new Date(),
          error: null
        }
      });
      lastSeenId = entry.id;
      progressed = true;
      remaining -= 1;
      sent += 1;
    } catch (error) {
      await context.prisma.socialAlertDelivery.update({
        where: { id: claim.delivery.id },
        data: {
          status: "FAILED",
          error: (error instanceof Error ? error.message : "Unknown error").slice(0, 2_000)
        }
      });
      throw error;
    }
  }

  await markHealthy(context, alert, { lastSeenId });
  return sent > 0 ? "sent" : progressed ? "unchanged" : "rate-limited";
}

export async function checkSocialAlerts(
  context: CommandContext,
  options: {
    guildId?: string;
    force?: boolean;
  } = {}
): Promise<SocialAlertCheckSummary> {
  if (Date.now() - lastDeliveryPruneAt > 24 * 60 * 60_000) {
    lastDeliveryPruneAt = Date.now();
    await context.prisma.socialAlertDelivery
      .deleteMany({
        where: {
          OR: [
            {
              status: "SENT",
              createdAt: {
                lt: new Date(Date.now() - 90 * 24 * 60 * 60_000)
              }
            },
            {
              status: { in: ["FAILED", "PENDING"] },
              createdAt: {
                lt: new Date(Date.now() - 30 * 24 * 60 * 60_000)
              }
            }
          ]
        }
      })
      .catch((error) => {
        context.logger.warn("Failed to prune social alert delivery history", { error });
      });
  }

  const alerts = await context.prisma.socialAlert.findMany({
    where: {
      enabled: true,
      guildId: options.guildId,
      ...(options.force ? {} : { nextCheckAt: { lte: new Date() } })
    },
    orderBy: {
      nextCheckAt: "asc"
    },
    take: 100
  });
  const summary: SocialAlertCheckSummary = {
    checked: 0,
    sent: 0,
    baselined: 0,
    unchanged: 0,
    rateLimited: 0,
    skipped: 0,
    failed: 0
  };

  for (const alert of alerts) {
    const canCheck = await shouldCheckAlert(context, alert, options.force);

    if (!canCheck) {
      summary.skipped += 1;
      continue;
    }

    summary.checked += 1;

    try {
      const result = await processSocialAlert(context, alert);

      if (result === "sent") {
        summary.sent += 1;
      } else if (result === "baseline") {
        summary.baselined += 1;
      } else if (result === "unchanged") {
        summary.unchanged += 1;
      } else if (result === "rate-limited") {
        summary.rateLimited += 1;
      } else {
        summary.skipped += 1;
      }
    } catch (error) {
      summary.failed += 1;
      await markFailed(context, alert, error).catch(() => null);
      context.logger.warn("Failed to check social alert", {
        alertId: alert.id,
        guildId: alert.guildId,
        sourceId: alert.sourceId,
        error
      });
    }
  }

  return summary;
}

export async function testSocialAlert(context: CommandContext, guildId: string, alertId: string) {
  const alert = await context.prisma.socialAlert.findFirst({
    where: {
      id: alertId,
      guildId,
      enabled: true
    }
  });

  if (!alert) {
    return {
      ok: false as const,
      message: "找不到通知來源，或通知已停用。"
    };
  }

  try {
    const entry = (await fetchLatestEntries(alert))[0];

    if (!entry) {
      return {
        ok: false as const,
        message:
          alert.type === SocialAlertType.TWITCH
            ? "目前沒有直播，或 Twitch 憑證尚未設定。"
            : "來源目前沒有可用的新項目。"
      };
    }

    const sent = await sendAlertMessage(context, alert, entry, "[測試] ");

    return sent
      ? {
          ok: true as const,
          message: `測試通知已傳送至 <#${alert.channelId}>。`
        }
      : {
          ok: false as const,
          message: "無法傳送到設定的通知頻道。"
        };
  } catch (error) {
    return {
      ok: false as const,
      message: `測試失敗：${error instanceof Error ? error.message : "未知錯誤"}`
    };
  }
}
