import { NextResponse } from "next/server";

import { ModuleKey } from "@guildforge/database";
import { moderationSettingsSchema } from "@guildforge/shared";

import { requireGuildApiAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    guildId: string;
  }>;
};

export async function PATCH(request: Request, { params: paramsPromise }: RouteContext) {
  const params = await paramsPromise;
  const access = await requireGuildApiAccess(params.guildId);

  if (!access.ok) {
    return access.response;
  }

  const parsed = moderationSettingsSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "管理功能設定格式不正確" }, { status: 400 });
  }

  const settings = parsed.data;

  const moduleConfig = await prisma.moduleConfig.upsert({
    where: {
      guildId_module: {
        guildId: params.guildId,
        module: ModuleKey.MODERATION
      }
    },
    create: {
      guildId: params.guildId,
      module: ModuleKey.MODERATION,
      enabled: true,
      settings
    },
    update: {
      settings
    }
  });

  await prisma.auditLog.create({
    data: {
      guildId: params.guildId,
      actorUserId: access.session.user.discordId,
      action: "DASHBOARD_MODERATION_SETTINGS_UPDATE",
      targetType: "ModuleConfig",
      targetId: moduleConfig.id
    }
  });

  return NextResponse.json({
    settings
  });
}
