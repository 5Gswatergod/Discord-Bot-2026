import type { Message } from "discord.js";

import { SocialAlertType, type SocialAlert } from "@guildforge/database";
import { buildSocialAlertSourceUrl, formatTemplate } from "@guildforge/shared";

import type { CommandContext } from "../../commands/types";
import { env } from "../../env";
import { isSendableGuildTextChannel } from "../channels";
import { isGuildModuleEnabled } from "../modules";

type SocialAlertEntry = {
  id: string;
  title: string;
  url: string;
  author: string;
  publishedAt: string | null;
};

type SocialAlertResult = "sent" | "baseline" | "unchanged" | "no-entry" | "skipped";

type SocialAlertCheckSummary = {
  checked: number;
  sent: number;
  baselined: number;
  unchanged: number;
  skipped: number;
  failed: number;
};

const localCheckTimestamps = new Map<string, number>();

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10))
    )
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readTag(block: string, tag: string) {
  const escapedTag = escapeRegExp(tag);
  const match = block.match(new RegExp(`<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}>`, "i"));

  return match ? decodeXml(match[1]) : null;
}

function readLink(block: string) {
  const href = block.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i)?.[1];

  if (href) {
    return decodeXml(href);
  }

  return readTag(block, "link");
}

function formatDiscordTimestamp(value: string | null) {
  if (!value) {
    return "";
  }

  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? "" : `<t:${Math.floor(timestamp / 1000)}:R>`;
}

function parseFeedEntries(xml: string): SocialAlertEntry[] {
  const entryMatches = [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)];
  const itemMatches = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)];
  const blocks = (entryMatches.length > 0 ? entryMatches : itemMatches).map((match) => match[1]);

  return blocks
    .map((block) => {
      const videoId = readTag(block, "yt:videoId");
      const url = videoId ? `https://www.youtube.com/watch?v=${videoId}` : readLink(block);
      const id = videoId ?? readTag(block, "id") ?? readTag(block, "guid") ?? url;
      const title = readTag(block, "title") ?? "Untitled update";
      const author = readTag(block, "name") ?? readTag(block, "author") ?? "Unknown source";
      const publishedAt =
        readTag(block, "published") ?? readTag(block, "updated") ?? readTag(block, "pubDate");

      if (!id || !url) {
        return null;
      }

      return {
        id,
        title,
        url,
        author,
        publishedAt
      };
    })
    .filter((entry): entry is SocialAlertEntry => Boolean(entry))
    .sort((left, right) => {
      const leftTime = left.publishedAt ? Date.parse(left.publishedAt) : 0;
      const rightTime = right.publishedAt ? Date.parse(right.publishedAt) : 0;

      return rightTime - leftTime;
    });
}

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": "GuildForge/0.1 Social Alerts",
        ...init.headers
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFeedEntry(alert: SocialAlert) {
  const sourceUrl = buildSocialAlertSourceUrl(alert.type, alert.sourceId, alert.sourceUrl);
  const response = await fetchWithTimeout(sourceUrl);

  if (!response.ok) {
    throw new Error(`Feed request failed with ${response.status}`);
  }

  const entries = parseFeedEntries(await response.text());

  return entries[0] ?? null;
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

async function fetchTwitchEntry(alert: SocialAlert): Promise<SocialAlertEntry | null> {
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_ACCESS_TOKEN) {
    return null;
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
    throw new Error(`Twitch request failed with ${response.status}`);
  }

  const data = (await response.json()) as TwitchStreamsResponse;
  const stream = data.data?.[0];

  if (!stream?.id) {
    return null;
  }

  return {
    id: stream.id,
    title: stream.title ?? `${stream.user_name ?? alert.sourceId} is live`,
    url: alert.sourceUrl || `https://www.twitch.tv/${stream.user_login ?? alert.sourceId}`,
    author: stream.user_name ?? alert.sourceId,
    publishedAt: stream.started_at ?? null
  };
}

async function fetchLatestEntry(alert: SocialAlert) {
  if (alert.type === SocialAlertType.TWITCH) {
    return fetchTwitchEntry(alert);
  }

  return fetchFeedEntry(alert);
}

async function shouldCheckAlert(context: CommandContext, alert: SocialAlert, force = false) {
  if (force) {
    return true;
  }

  const intervalSeconds = Math.max(60, alert.intervalSeconds);

  if (context.redis) {
    const result = await context.redis.set(
      `social-alert:${alert.id}:checked`,
      String(Date.now()),
      "EX",
      intervalSeconds,
      "NX"
    );

    return result === "OK";
  }

  const now = Date.now();
  const lastCheckedAt = localCheckTimestamps.get(alert.id) ?? 0;

  if (now - lastCheckedAt < intervalSeconds * 1000) {
    return false;
  }

  localCheckTimestamps.set(alert.id, now);
  return true;
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

  const content = formatTemplate(alert.messageTemplate, {
    title: entry.title,
    url: entry.url,
    author: entry.author,
    source: alert.sourceId,
    type: alert.type,
    server: guild.name,
    publishedAt: formatDiscordTimestamp(entry.publishedAt)
  }).trim();

  return channel.send({
    content: `${prefix}${content || `${entry.title}\n${entry.url}`}`.slice(0, 2000)
  });
}

async function processSocialAlert(
  context: CommandContext,
  alert: SocialAlert,
  options: {
    forceSend?: boolean;
  } = {}
): Promise<SocialAlertResult> {
  const moduleEnabled = await isGuildModuleEnabled(context.prisma, alert.guildId, "SOCIAL_ALERTS");

  if (!moduleEnabled) {
    return "skipped";
  }

  const entry = await fetchLatestEntry(alert);

  if (!entry) {
    return "no-entry";
  }

  if (!alert.lastSeenId && !options.forceSend) {
    await context.prisma.socialAlert.update({
      where: {
        id: alert.id
      },
      data: {
        lastSeenId: entry.id
      }
    });
    return "baseline";
  }

  if (alert.lastSeenId === entry.id && !options.forceSend) {
    return "unchanged";
  }

  const message = await sendAlertMessage(context, alert, entry);

  if (!message) {
    throw new Error("Alert channel is not available");
  }

  if (!options.forceSend) {
    await context.prisma.socialAlert.update({
      where: {
        id: alert.id
      },
      data: {
        lastSeenId: entry.id
      }
    });
  }

  return "sent";
}

export async function checkSocialAlerts(
  context: CommandContext,
  options: {
    guildId?: string;
    force?: boolean;
  } = {}
): Promise<SocialAlertCheckSummary> {
  const alerts = await context.prisma.socialAlert.findMany({
    where: {
      enabled: true,
      guildId: options.guildId
    },
    orderBy: {
      updatedAt: "asc"
    },
    take: 100
  });
  const summary: SocialAlertCheckSummary = {
    checked: 0,
    sent: 0,
    baselined: 0,
    unchanged: 0,
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
      } else {
        summary.skipped += 1;
      }
    } catch (error) {
      summary.failed += 1;
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
      message: "Social alert not found or disabled."
    };
  }

  const entry = await fetchLatestEntry(alert);

  if (!entry) {
    return {
      ok: false as const,
      message:
        alert.type === SocialAlertType.TWITCH
          ? "No live Twitch stream found, or Twitch credentials are not configured."
          : "No feed entry found."
    };
  }

  const sent = await sendAlertMessage(context, alert, entry, "[Test] ");

  return sent
    ? {
        ok: true as const,
        message: `Sent a test alert to <#${alert.channelId}>.`
      }
    : {
        ok: false as const,
        message: "Could not send to the configured alert channel."
      };
}
