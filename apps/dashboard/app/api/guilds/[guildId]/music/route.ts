import { NextResponse } from "next/server";

import { ModuleKey } from "@guildforge/database";
import { musicSettingsSchema } from "@guildforge/shared";

import { requireGuildApiAccess } from "@/lib/api-auth";
import { getDiscordGuildResources } from "@/lib/discord-resources";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    guildId: string;
  }>;
};

const textChannelTypes = new Set([0, 5, 15, 16]);

export async function GET(_request: Request, { params: paramsPromise }: RouteContext) {
  const params = await paramsPromise;
  const access = await requireGuildApiAccess(params.guildId);

  if (!access.ok) {
    return access.response;
  }

  const config = await prisma.moduleConfig.findUnique({
    where: {
      guildId_module: {
        guildId: params.guildId,
        module: ModuleKey.MUSIC
      }
    }
  });

  return NextResponse.json({
    settings: musicSettingsSchema.parse(config?.settings ?? {})
  });
}

export async function PATCH(request: Request, { params: paramsPromise }: RouteContext) {
  const params = await paramsPromise;
  const access = await requireGuildApiAccess(params.guildId);

  if (!access.ok) {
    return access.response;
  }

  const parsed = musicSettingsSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "音樂播放器設定格式不正確"
      },
      { status: 400 }
    );
  }

  const resources = await getDiscordGuildResources(params.guildId).catch(() => null);

  if (!resources) {
    return NextResponse.json(
      { error: "無法向 Discord 驗證頻道與身分組，請稍後再試。" },
      { status: 503 }
    );
  }

  const channelMap = new Map(resources.channels.map((channel) => [channel.id, channel]));
  const roleIds = new Set(resources.roles.map((role) => role.id));
  const referencedChannelIds = [
    ...parsed.data.requestChannelIds,
    parsed.data.announcementChannelId
  ].filter((channelId): channelId is string => Boolean(channelId));
  const invalidChannelId = referencedChannelIds.find((channelId) => {
    const channel = channelMap.get(channelId);
    return !channel || !textChannelTypes.has(channel.type);
  });

  if (invalidChannelId) {
    return NextResponse.json(
      { error: "選擇的點歌或公告頻道已刪除，或不是可傳送訊息的頻道。" },
      { status: 400 }
    );
  }

  if (parsed.data.djRoleId && !roleIds.has(parsed.data.djRoleId)) {
    return NextResponse.json({ error: "選擇的 DJ 身分組已刪除或無法存取。" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.moduleConfig.upsert({
      where: {
        guildId_module: {
          guildId: params.guildId,
          module: ModuleKey.MUSIC
        }
      },
      create: {
        guildId: params.guildId,
        module: ModuleKey.MUSIC,
        enabled: true,
        settings: parsed.data
      },
      update: {
        settings: parsed.data
      }
    }),
    prisma.auditLog.create({
      data: {
        guildId: params.guildId,
        actorUserId: access.session.user.discordId,
        action: "DASHBOARD_MUSIC_UPDATE",
        targetType: "MusicSettings"
      }
    })
  ]);

  return NextResponse.json({
    settings: parsed.data
  });
}
