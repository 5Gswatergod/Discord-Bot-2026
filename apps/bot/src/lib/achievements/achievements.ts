import { Prisma, type Achievement, type AchievementTrigger } from "@guildforge/database";
import { achievementSettingsSchema, formatTemplate } from "@guildforge/shared";

import type { CommandContext } from "../../commands/types";
import { isSendableGuildTextChannel } from "../channels";
import { getGuildModuleSettings } from "../modules";

async function getMetric(
  context: CommandContext,
  guildId: string,
  userId: string,
  trigger: AchievementTrigger
) {
  if (trigger === "MESSAGE_COUNT") {
    return (
      (
        await context.prisma.memberActivity.findUnique({
          where: {
            guildId_userId: { guildId, userId }
          },
          select: { messageCount: true }
        })
      )?.messageCount ?? 0
    );
  }

  if (trigger === "LEVEL") {
    return (
      (
        await context.prisma.levelingUser.findUnique({
          where: {
            guildId_userId: { guildId, userId }
          },
          select: { level: true }
        })
      )?.level ?? 0
    );
  }

  return context.prisma.inviteAttribution.count({
    where: {
      guildId,
      inviterUserId: userId
    }
  });
}

async function announceAchievement(
  context: CommandContext,
  guildId: string,
  userId: string,
  achievement: Achievement
) {
  const config = await getGuildModuleSettings(context.prisma, guildId, "ACHIEVEMENTS");
  const rawSettings =
    typeof config.settings === "object" && config.settings !== null
      ? config.settings
      : {};
  const settings = achievementSettingsSchema.parse({
    ...rawSettings,
    achievements: []
  });
  const guild = context.client.guilds.cache.get(guildId);

  if (!guild) {
    return;
  }

  const member = await guild.members.fetch(userId).catch(() => null);

  if (member && achievement.rewardRoleId) {
    await member.roles
      .add(achievement.rewardRoleId, `Hydrava achievement: ${achievement.name}`)
      .catch((error) => {
        context.logger.warn("Failed to assign achievement reward role", {
          guildId,
          userId,
          achievementId: achievement.id,
          roleId: achievement.rewardRoleId,
          error
        });
      });
  }

  if (!settings.announcementChannelId) {
    return;
  }

  const channel = await guild.channels.fetch(settings.announcementChannelId).catch(() => null);

  if (!isSendableGuildTextChannel(channel)) {
    return;
  }

  await channel.send({
    content: formatTemplate(settings.announcementMessage, {
      user: `<@${userId}>`,
      username: member?.user.username ?? userId,
      achievement: achievement.name,
      description: achievement.description ?? "",
      icon: achievement.icon ?? "🏆"
    }),
    allowedMentions: {
      users: [userId]
    }
  });
}

export async function checkUserAchievements(
  context: CommandContext,
  guildId: string,
  userId: string
) {
  const config = await getGuildModuleSettings(context.prisma, guildId, "ACHIEVEMENTS");

  if (!config.enabled) {
    return;
  }

  const achievements = await context.prisma.achievement.findMany({
    where: {
      guildId,
      enabled: true,
      awards: {
        none: {
          userId
        }
      }
    },
    orderBy: {
      threshold: "asc"
    }
  });
  const metricCache = new Map<AchievementTrigger, number>();

  for (const achievement of achievements) {
    let metric = metricCache.get(achievement.trigger);

    if (metric === undefined) {
      metric = await getMetric(context, guildId, userId, achievement.trigger);
      metricCache.set(achievement.trigger, metric);
    }

    if (metric < achievement.threshold) {
      continue;
    }

    try {
      await context.prisma.achievementAward.create({
        data: {
          guildId,
          achievementId: achievement.id,
          userId
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }

      throw error;
    }

    await announceAchievement(context, guildId, userId, achievement);
  }
}

export async function recordMessageActivity(
  context: CommandContext,
  guildId: string,
  userId: string
) {
  const config = await getGuildModuleSettings(context.prisma, guildId, "ACHIEVEMENTS");

  if (!config.enabled) {
    return;
  }

  await context.prisma.memberActivity.upsert({
    where: {
      guildId_userId: { guildId, userId }
    },
    create: {
      guildId,
      userId,
      messageCount: 1
    },
    update: {
      messageCount: {
        increment: 1
      }
    }
  });

  await checkUserAchievements(context, guildId, userId);
}

export async function getAchievementProgress(
  context: CommandContext,
  guildId: string,
  userId: string
) {
  const achievements = await context.prisma.achievement.findMany({
    where: {
      guildId,
      enabled: true
    },
    include: {
      awards: {
        where: { userId },
        select: { awardedAt: true }
      }
    },
    orderBy: [{ trigger: "asc" }, { threshold: "asc" }]
  });
  const metricCache = new Map<AchievementTrigger, number>();

  return Promise.all(
    achievements.map(async (achievement) => {
      let progress = metricCache.get(achievement.trigger);

      if (progress === undefined) {
        progress = await getMetric(context, guildId, userId, achievement.trigger);
        metricCache.set(achievement.trigger, progress);
      }

      return {
        achievement,
        progress,
        awardedAt: achievement.awards[0]?.awardedAt ?? null
      };
    })
  );
}
