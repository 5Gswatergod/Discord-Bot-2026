import { NextResponse } from "next/server";

import { AchievementTrigger, ModuleKey } from "@guildforge/database";
import { achievementSettingsSchema } from "@guildforge/shared";

import { requireGuildApiAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ guildId: string }>;
};

export async function PATCH(request: Request, { params: paramsPromise }: RouteContext) {
  const params = await paramsPromise;
  const access = await requireGuildApiAccess(params.guildId);

  if (!access.ok) return access.response;

  const parsed = achievementSettingsSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "成就設定格式不正確" }, { status: 400 });
  }

  const ids = [
    ...new Set(parsed.data.achievements.map((achievement) => achievement.id).filter(Boolean))
  ] as string[];

  if (ids.length > 0) {
    const ownedCount = await prisma.achievement.count({
      where: {
        guildId: params.guildId,
        id: { in: ids }
      }
    });

    if (ownedCount !== ids.length) {
      return NextResponse.json({ error: "找不到成就" }, { status: 404 });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.moduleConfig.upsert({
      where: {
        guildId_module: {
          guildId: params.guildId,
          module: ModuleKey.ACHIEVEMENTS
        }
      },
      create: {
        guildId: params.guildId,
        module: ModuleKey.ACHIEVEMENTS,
        enabled: true,
        settings: {
          announcementChannelId: parsed.data.announcementChannelId,
          announcementMessage: parsed.data.announcementMessage
        }
      },
      update: {
        settings: {
          announcementChannelId: parsed.data.announcementChannelId,
          announcementMessage: parsed.data.announcementMessage
        }
      }
    });

    await tx.achievement.deleteMany({
      where: {
        guildId: params.guildId,
        ...(ids.length > 0 ? { id: { notIn: ids } } : {})
      }
    });

    for (const id of ids) {
      await tx.achievement.update({
        where: { id },
        data: {
          name: `${"_".repeat(100)}hydrava_pending_${id}`
        }
      });
    }

    for (const achievement of parsed.data.achievements) {
      const data = {
        name: achievement.name,
        description: achievement.description || null,
        icon: achievement.icon || null,
        trigger: achievement.trigger as AchievementTrigger,
        threshold: achievement.threshold,
        rewardRoleId: achievement.rewardRoleId,
        enabled: achievement.enabled
      };

      if (achievement.id) {
        await tx.achievement.update({
          where: { id: achievement.id },
          data
        });
      } else {
        await tx.achievement.create({
          data: {
            guildId: params.guildId,
            ...data
          }
        });
      }
    }

    await tx.auditLog.create({
      data: {
        guildId: params.guildId,
        actorUserId: access.session.user.discordId,
        action: "DASHBOARD_ACHIEVEMENTS_UPDATE",
        targetType: "Achievement"
      }
    });
  });

  return NextResponse.json({ settings: parsed.data });
}
