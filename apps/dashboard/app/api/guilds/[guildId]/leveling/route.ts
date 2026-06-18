import { NextResponse } from "next/server";

import { ModuleKey } from "@guildforge/database";
import { levelingUpdateSchema } from "@guildforge/shared";

import { requireGuildApiAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: {
    guildId: string;
  };
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const access = await requireGuildApiAccess(params.guildId);

  if (!access.ok) {
    return access.response;
  }

  const parsed = levelingUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid leveling settings" }, { status: 400 });
  }

  const { rewards, ...settings } = parsed.data;

  const moduleConfig = await prisma.$transaction(async (tx) => {
    const config = await tx.moduleConfig.upsert({
      where: {
        guildId_module: {
          guildId: params.guildId,
          module: ModuleKey.LEVELING
        }
      },
      create: {
        guildId: params.guildId,
        module: ModuleKey.LEVELING,
        enabled: true,
        settings
      },
      update: {
        settings
      }
    });

    await tx.levelReward.deleteMany({
      where: {
        guildId: params.guildId
      }
    });

    if (rewards.length > 0) {
      await tx.levelReward.createMany({
        data: rewards.map((reward) => ({
          guildId: params.guildId,
          level: reward.level,
          roleId: reward.roleId,
          stackable: reward.stackable
        }))
      });
    }

    return config;
  });

  await prisma.auditLog.create({
    data: {
      guildId: params.guildId,
      actorUserId: access.session.user.discordId,
      action: "DASHBOARD_LEVELING_SETTINGS_UPDATE",
      targetType: "ModuleConfig",
      targetId: moduleConfig.id
    }
  });

  return NextResponse.json({
    settings,
    rewards
  });
}
