import type { Message } from "discord.js";

import { AiRequestStatus } from "@guildforge/database";
import { aiAssistantSettingsSchema } from "@guildforge/shared";

import type { CommandContext } from "../../commands/types";
import { env } from "../../env";
import { getGuildModuleSettings } from "../modules";

type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type AiChatCompletionResponse = {
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

function startOfUtcDay(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function consumeDailyQuota(
  context: CommandContext,
  guildId: string,
  limit: number
) {
  if (context.redis) {
    const now = new Date();
    const dateKey = now.toISOString().slice(0, 10);
    const key = `ai-assistant:quota:${guildId}:${dateKey}`;
    const count = await context.redis.incr(key);

    if (count === 1) {
      const nextUtcDay = startOfUtcDay(new Date(now.getTime() + 24 * 60 * 60 * 1_000));
      await context.redis.expire(key, Math.max(60, Math.ceil((nextUtcDay.getTime() - now.getTime()) / 1_000)));
    }

    return count <= limit;
  }

  const usedToday = await context.prisma.aiAssistantRequest.count({
    where: {
      guildId,
      status: {
        in: [AiRequestStatus.SUCCESS, AiRequestStatus.FAILED]
      },
      createdAt: {
        gte: startOfUtcDay()
      }
    }
  });

  return usedToday < limit;
}

function splitDiscordMessage(content: string) {
  const chunks: string[] = [];
  let remaining = content;

  while (remaining.length > 2_000) {
    let splitAt = remaining.lastIndexOf("\n", 2_000);

    if (splitAt < 1_000) {
      splitAt = 2_000;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
}

async function loadConversation(
  message: Message<true>,
  botUserId: string,
  limit: number
): Promise<AiChatMessage[]> {
  if (!("messages" in message.channel)) {
    return [{ role: "user", content: message.content }];
  }

  const recent = await message.channel.messages
    .fetch({ limit: Math.min(50, limit + 1) })
    .catch(() => null);

  if (!recent) {
    return [{ role: "user", content: message.content }];
  }

  return [...recent.values()]
    .filter((item) => item.content.trim() && !item.author.system)
    .sort((left, right) => left.createdTimestamp - right.createdTimestamp)
    .slice(-limit)
    .map((item) => ({
      role: item.author.id === botUserId ? ("assistant" as const) : ("user" as const),
      content: `${item.member?.displayName ?? item.author.username}: ${item.content}`.slice(0, 4_000)
    }));
}

async function recordRequest(
  context: CommandContext,
  input: {
    guildId: string;
    userId: string;
    channelId: string;
    messageId: string;
    status: AiRequestStatus;
    model?: string;
    inputChars?: number;
    outputChars?: number;
    error?: string;
  }
) {
  await context.prisma.aiAssistantRequest
    .create({
      data: {
        guildId: input.guildId,
        userId: input.userId,
        channelId: input.channelId,
        messageId: input.messageId,
        status: input.status,
        model: input.model,
        inputChars: input.inputChars ?? 0,
        outputChars: input.outputChars ?? 0,
        error: input.error?.slice(0, 1_000)
      }
    })
    .catch(() => null);
}

export async function handleAiAssistantMessage(
  message: Message<true>,
  context: CommandContext
) {
  const moduleConfig = await getGuildModuleSettings(
    context.prisma,
    message.guildId,
    "AI_ASSISTANT"
  );

  if (!moduleConfig.enabled) {
    return false;
  }

  const settings = aiAssistantSettingsSchema.parse(moduleConfig.settings ?? {});

  if (settings.channelIds.length > 0 && !settings.channelIds.includes(message.channelId)) {
    return false;
  }

  const botUser = context.client.user;

  if (!botUser) {
    return false;
  }

  const mentioned = message.mentions.users.has(botUser.id);
  let repliedToBot = false;

  if (message.reference?.messageId && "messages" in message.channel) {
    const referenced = await message.channel.messages
      .fetch(message.reference.messageId)
      .catch(() => null);
    repliedToBot = referenced?.author.id === botUser.id;
  }

  if (settings.mentionOnly && !mentioned && !repliedToBot) {
    return false;
  }

  const prompt = message.content.replace(new RegExp(`<@!?${botUser.id}>`, "g"), "").trim();

  if (!prompt) {
    return false;
  }

  const existing = await context.prisma.aiAssistantRequest.findUnique({
    where: {
      guildId_messageId: {
        guildId: message.guildId,
        messageId: message.id
      }
    },
    select: { id: true }
  });

  if (existing) {
    return true;
  }

  if (!env.AI_API_KEY || !env.AI_MODEL) {
    await message.reply({
      content: "此伺服器已啟用 AI 助理，但管理員尚未完成模型金鑰設定。",
      allowedMentions: { repliedUser: false }
    });
    return true;
  }

  if (!(await consumeDailyQuota(context, message.guildId, settings.dailyRequestLimit))) {
    await recordRequest(context, {
      guildId: message.guildId,
      userId: message.author.id,
      channelId: message.channelId,
      messageId: message.id,
      status: AiRequestStatus.BLOCKED,
      error: "Daily guild request limit reached"
    });
    await message.reply({
      content: "今天的 AI 使用額度已達上限，請稍後再試。",
      allowedMentions: { repliedUser: false }
    });
    return true;
  }

  const conversation = await loadConversation(message, botUser.id, settings.maxContextMessages);
  const messages: AiChatMessage[] = [
    {
      role: "system",
      content: `${settings.systemPrompt}\n你的名稱是 ${settings.personaName}。不要假裝能執行你無法執行的 Discord 管理操作。`
    },
    ...conversation
  ];
  const inputChars = messages.reduce((total, item) => total + item.content.length, 0);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    if ("sendTyping" in message.channel) {
      await message.channel.sendTyping().catch(() => null);
    }

    const response = await fetch(
      `${(env.AI_API_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.AI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: env.AI_MODEL,
          messages,
          temperature: settings.temperature,
          max_tokens: Math.min(2_000, Math.ceil(settings.maxResponseCharacters / 2))
        }),
        signal: controller.signal
      }
    );
    const body = (await response.json().catch(() => null)) as AiChatCompletionResponse | null;

    if (!response.ok) {
      throw new Error(body?.error?.message ?? `AI provider returned ${response.status}`);
    }

    const output = body?.choices?.[0]?.message?.content?.trim();

    if (!output) {
      throw new Error("AI provider returned an empty response");
    }

    const limitedOutput = output.slice(0, settings.maxResponseCharacters);
    const chunks = splitDiscordMessage(limitedOutput);

    for (const [index, chunk] of chunks.entries()) {
      if (index === 0) {
        await message.reply({
          content: chunk,
          allowedMentions: { repliedUser: false }
        });
      } else if ("send" in message.channel) {
        await message.channel.send({
          content: chunk,
          allowedMentions: { parse: [] }
        });
      }
    }

    await recordRequest(context, {
      guildId: message.guildId,
      userId: message.author.id,
      channelId: message.channelId,
      messageId: message.id,
      status: AiRequestStatus.SUCCESS,
      model: body?.model ?? env.AI_MODEL,
      inputChars,
      outputChars: limitedOutput.length
    });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Unknown AI provider error";
    await recordRequest(context, {
      guildId: message.guildId,
      userId: message.author.id,
      channelId: message.channelId,
      messageId: message.id,
      status: AiRequestStatus.FAILED,
      model: env.AI_MODEL,
      inputChars,
      error: messageText
    });
    context.logger.warn("AI assistant request failed", {
      guildId: message.guildId,
      channelId: message.channelId,
      error
    });
    await message.reply({
      content: "AI 助理暫時無法回覆，請稍後再試。",
      allowedMentions: { repliedUser: false }
    });
  } finally {
    clearTimeout(timeout);
  }

  return true;
}
