import { NextResponse } from "next/server";

import { ModuleKey } from "@guildforge/database";
import { aiAssistantSettingsSchema } from "@guildforge/shared";

import { requireGuildApiAccess } from "@/lib/api-auth";
import { getDiscordGuildResources } from "@/lib/discord-resources";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: { guildId: string };
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const access = await requireGuildApiAccess(params.guildId);

  if (!access.ok) return access.response;

  const parsed = aiAssistantSettingsSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "AI 助理設定格式不正確" }, { status: 400 });
  }

  const resources = await getDiscordGuildResources(params.guildId).catch(() => null);

  if (!resources) {
    return NextResponse.json({ error: "目前無法驗證 Discord 頻道" }, { status: 502 });
  }

  const channelIds = new Set(resources.channels.map((channel) => channel.id));

  if (parsed.data.channelIds.some((channelId) => !channelIds.has(channelId))) {
    return NextResponse.json({ error: "AI 助理包含已刪除或無法存取的頻道" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.moduleConfig.upsert({
      where: {
        guildId_module: {
          guildId: params.guildId,
          module: ModuleKey.AI_ASSISTANT
        }
      },
      create: {
        guildId: params.guildId,
        module: ModuleKey.AI_ASSISTANT,
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
        action: "DASHBOARD_AI_ASSISTANT_UPDATE",
        targetType: "AiAssistantSettings"
      }
    })
  ]);

  return NextResponse.json({ settings: parsed.data });
}
