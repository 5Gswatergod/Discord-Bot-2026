import { NextResponse } from "next/server";

import { ModuleKey } from "@guildforge/database";
import { temporaryVoiceSettingsSchema } from "@guildforge/shared";

import { requireGuildApiAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: { guildId: string };
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const access = await requireGuildApiAccess(params.guildId);

  if (!access.ok) return access.response;

  const parsed = temporaryVoiceSettingsSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "臨時語音頻道設定格式不正確" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.moduleConfig.upsert({
      where: {
        guildId_module: {
          guildId: params.guildId,
          module: ModuleKey.TEMPORARY_VOICE
        }
      },
      create: {
        guildId: params.guildId,
        module: ModuleKey.TEMPORARY_VOICE,
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
        action: "DASHBOARD_TEMPORARY_VOICE_UPDATE",
        targetType: "TemporaryVoiceSettings"
      }
    })
  ]);

  return NextResponse.json({ settings: parsed.data });
}
