import { NextResponse } from "next/server";

import { ModuleKey } from "@guildforge/database";
import { web3SettingsSchema } from "@guildforge/shared";

import { requireGuildApiAccess } from "@/lib/api-auth";
import { getDiscordGuildResources } from "@/lib/discord-resources";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ guildId: string }>;
};

export async function PATCH(request: Request, { params: paramsPromise }: RouteContext) {
  const params = await paramsPromise;
  const access = await requireGuildApiAccess(params.guildId);

  if (!access.ok) return access.response;

  const parsed = web3SettingsSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Web3 設定格式不正確" }, { status: 400 });
  }

  const resources = await getDiscordGuildResources(params.guildId).catch(() => null);

  if (!resources) {
    return NextResponse.json({ error: "目前無法驗證 Discord 頻道與身分組" }, { status: 502 });
  }

  const channelIds = new Set(resources.channels.map((channel) => channel.id));
  const assignableRoleIds = new Set(
    resources.roles.filter((role) => role.assignable).map((role) => role.id)
  );
  const invalidResource = parsed.data.collections.some(
    (collection) =>
      !assignableRoleIds.has(collection.roleId) ||
      collection.privateChannelIds.some((channelId) => !channelIds.has(channelId))
  );

  if (
    invalidResource ||
    (parsed.data.announcementChannelId &&
      !channelIds.has(parsed.data.announcementChannelId))
  ) {
    return NextResponse.json(
      { error: "Web3 收藏包含已刪除、無法存取或機器人無法指派的資源" },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.moduleConfig.upsert({
      where: {
        guildId_module: {
          guildId: params.guildId,
          module: ModuleKey.WEB3
        }
      },
      create: {
        guildId: params.guildId,
        module: ModuleKey.WEB3,
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
        action: "DASHBOARD_WEB3_UPDATE",
        targetType: "Web3Settings"
      }
    })
  ]);

  return NextResponse.json({ settings: parsed.data });
}
