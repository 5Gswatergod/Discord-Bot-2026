import { NextResponse } from "next/server";

import { GiveawayStatus, ModuleKey } from "@guildforge/database";
import { giveawaysUpdateSchema } from "@guildforge/shared";

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

  const parsed = giveawaysUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "抽獎設定格式不正確" }, { status: 400 });
  }

  const input = parsed.data;
  const giveawayIds = [
    ...new Set(input.giveaways.map((giveaway) => giveaway.id).filter(Boolean))
  ] as string[];

  if (giveawayIds.length > 0) {
    const ownedGiveawayCount = await prisma.giveaway.count({
      where: {
        guildId: params.guildId,
        id: {
          in: giveawayIds
        }
      }
    });

    if (ownedGiveawayCount !== giveawayIds.length) {
      return NextResponse.json({ error: "找不到抽獎" }, { status: 404 });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.moduleConfig.upsert({
      where: {
        guildId_module: {
          guildId: params.guildId,
          module: ModuleKey.GIVEAWAYS
        }
      },
      create: {
        guildId: params.guildId,
        module: ModuleKey.GIVEAWAYS,
        enabled: true
      },
      update: {}
    });

    for (const giveaway of input.giveaways) {
      const giveawayData = {
        channelId: giveaway.channelId,
        prize: giveaway.prize,
        winnerCount: giveaway.winnerCount,
        requiredRoleId: giveaway.requiredRoleId,
        endsAt: giveaway.endsAt
      };

      if (giveaway.id) {
        await tx.giveaway.update({
          where: {
            id: giveaway.id
          },
          data: giveawayData
        });
      } else {
        await tx.giveaway.create({
          data: {
            guildId: params.guildId,
            createdByUserId: access.session.user.discordId ?? "dashboard",
            status: GiveawayStatus.ACTIVE,
            ...giveawayData
          }
        });
      }
    }
  });

  await prisma.auditLog.create({
    data: {
      guildId: params.guildId,
      actorUserId: access.session.user.discordId,
      action: "DASHBOARD_GIVEAWAYS_UPDATE",
      targetType: "Giveaway"
    }
  });

  return NextResponse.json({ giveaways: input.giveaways });
}
