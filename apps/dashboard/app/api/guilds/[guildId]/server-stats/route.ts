import { NextResponse } from "next/server";

import { ModuleKey, ServerStatType } from "@guildforge/database";
import { serverStatsUpdateSchema } from "@guildforge/shared";

import { requireGuildApiAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: { guildId: string };
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const access = await requireGuildApiAccess(params.guildId);

  if (!access.ok) return access.response;

  const parsed = serverStatsUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "統計頻道設定格式不正確" }, { status: 400 });
  }

  const ids = [
    ...new Set(parsed.data.channels.map((channel) => channel.id).filter(Boolean))
  ] as string[];

  if (ids.length > 0) {
    const ownedCount = await prisma.serverStatChannel.count({
      where: {
        guildId: params.guildId,
        id: { in: ids }
      }
    });

    if (ownedCount !== ids.length) {
      return NextResponse.json({ error: "找不到統計頻道設定" }, { status: 404 });
    }
  }

  const existingChannels =
    ids.length > 0
      ? await prisma.serverStatChannel.findMany({
          where: {
            guildId: params.guildId,
            id: { in: ids }
          },
          select: {
            id: true,
            channelId: true
          }
        })
      : [];
  const channelIdByRecordId = new Map(
    existingChannels.map((channel) => [channel.id, channel.channelId])
  );

  await prisma.$transaction(async (tx) => {
    await tx.moduleConfig.upsert({
      where: {
        guildId_module: {
          guildId: params.guildId,
          module: ModuleKey.SERVER_STATS
        }
      },
      create: {
        guildId: params.guildId,
        module: ModuleKey.SERVER_STATS,
        enabled: true
      },
      update: {}
    });

    await tx.serverStatChannel.deleteMany({
      where: {
        guildId: params.guildId
      }
    });

    for (const channel of parsed.data.channels) {
      await tx.serverStatChannel.create({
        data: {
          ...(channel.id ? { id: channel.id } : {}),
          guildId: params.guildId,
          type: channel.type as ServerStatType,
          template: channel.template,
          categoryId: channel.categoryId,
          channelId: channel.id ? channelIdByRecordId.get(channel.id) ?? null : null,
          enabled: channel.enabled
        }
      });
    }

    await tx.auditLog.create({
      data: {
        guildId: params.guildId,
        actorUserId: access.session.user.discordId,
        action: "DASHBOARD_SERVER_STATS_UPDATE",
        targetType: "ServerStatChannel"
      }
    });
  });

  return NextResponse.json({ channels: parsed.data.channels });
}
