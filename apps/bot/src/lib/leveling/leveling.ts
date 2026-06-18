import { EmbedBuilder, type Message } from "discord.js";

import { formatTemplate, getLevelFromXp, levelingSettingsSchema } from "@guildforge/shared";

import type { CommandContext } from "../../commands/types";
import { getGuildModuleSettings, isGuildModuleEnabled } from "../modules";

export async function getLevelingSettings(context: CommandContext, guildId: string) {
  const config = await getGuildModuleSettings(context.prisma, guildId, "LEVELING");

  return {
    enabled: config.enabled,
    settings: levelingSettingsSchema.parse(config.settings ?? {})
  };
}

export async function handleLevelingMessage(message: Message<true>, context: CommandContext) {
  if (message.author.bot) {
    return;
  }

  const moduleEnabled = await isGuildModuleEnabled(context.prisma, message.guild.id, "LEVELING");

  if (!moduleEnabled) {
    return;
  }

  const { settings } = await getLevelingSettings(context, message.guild.id);

  if (settings.ignoredChannelIds.includes(message.channelId)) {
    return;
  }

  const cooldownKey = `leveling:cooldown:${message.guild.id}:${message.author.id}`;

  if (context.redis) {
    const activeCooldown = await context.redis.get(cooldownKey);

    if (activeCooldown) {
      return;
    }

    await context.redis.set(cooldownKey, "1", "EX", settings.cooldownSeconds);
  }

  const current = await context.prisma.levelingUser.upsert({
    where: {
      guildId_userId: {
        guildId: message.guild.id,
        userId: message.author.id
      }
    },
    create: {
      guildId: message.guild.id,
      userId: message.author.id,
      xp: settings.xpPerMessage,
      level: getLevelFromXp(settings.xpPerMessage, settings),
      messageCount: 1,
      lastXpAt: new Date()
    },
    update: {
      xp: {
        increment: settings.xpPerMessage
      },
      messageCount: {
        increment: 1
      },
      lastXpAt: new Date()
    }
  });
  const newXp = current.xp;
  const newLevel = getLevelFromXp(newXp, settings);

  if (newLevel <= current.level) {
    return;
  }

  await context.prisma.levelingUser.update({
    where: {
      guildId_userId: {
        guildId: message.guild.id,
        userId: message.author.id
      }
    },
    data: {
      level: newLevel
    }
  });

  const rewards = await context.prisma.levelReward.findMany({
    where: {
      guildId: message.guild.id,
      level: {
        lte: newLevel
      }
    },
    orderBy: {
      level: "asc"
    }
  });
  const member = await message.guild.members.fetch(message.author.id).catch(() => null);

  if (member) {
    for (const reward of rewards) {
      if (!reward.stackable && reward.level !== newLevel) {
        await member.roles.remove(reward.roleId).catch(() => null);
        continue;
      }

      await member.roles.add(reward.roleId, `Level reward ${reward.level}`).catch((error) => {
        context.logger.warn("Failed to assign level reward", {
          guildId: message.guild.id,
          userId: message.author.id,
          roleId: reward.roleId,
          error
        });
      });
    }
  }

  const channelId = settings.levelUpChannelId ?? message.channelId;
  const channel = await message.guild.channels.fetch(channelId).catch(() => null);
  const content = formatTemplate(settings.levelUpMessage, {
    user: `<@${message.author.id}>`,
    username: message.author.username,
    server: message.guild.name,
    memberCount: message.guild.memberCount,
    level: newLevel,
    xp: newXp
  });

  if (channel?.isTextBased()) {
    await channel.send({ content }).catch((error) => {
      context.logger.warn("Failed to send level up message", {
        guildId: message.guild.id,
        channelId,
        error
      });
    });
  }

  await context.prisma.auditLog.create({
    data: {
      guildId: message.guild.id,
      actorUserId: message.author.id,
      action: "LEVEL_UP",
      targetType: "LevelingUser",
      targetId: message.author.id,
      metadata: {
        level: newLevel,
        xp: newXp
      }
    }
  });
}

export function buildRankEmbed(input: {
  username: string;
  avatarUrl: string | null;
  xp: number;
  level: number;
  rank: number;
  messageCount: number;
}) {
  return new EmbedBuilder()
    .setColor(0x24b47e)
    .setTitle(`${input.username}'s rank`)
    .setThumbnail(input.avatarUrl)
    .addFields(
      {
        name: "Level",
        value: String(input.level),
        inline: true
      },
      {
        name: "XP",
        value: input.xp.toLocaleString(),
        inline: true
      },
      {
        name: "Rank",
        value: `#${input.rank}`,
        inline: true
      },
      {
        name: "Messages",
        value: input.messageCount.toLocaleString(),
        inline: true
      }
    );
}
