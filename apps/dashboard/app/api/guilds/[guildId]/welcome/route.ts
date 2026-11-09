import { NextResponse } from "next/server";

import { ModuleKey } from "@guildforge/database";
import { welcomeSettingsSchema } from "@guildforge/shared";

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

  const parsed = welcomeSettingsSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "歡迎訊息設定格式不正確" }, { status: 400 });
  }

  const settings = parsed.data;

  const [welcomeConfig] = await prisma.$transaction([
    prisma.welcomeConfig.upsert({
      where: {
        guildId: params.guildId
      },
      create: {
        guildId: params.guildId,
        ...settings
      },
      update: settings
    }),
    prisma.moduleConfig.upsert({
      where: {
        guildId_module: {
          guildId: params.guildId,
          module: ModuleKey.WELCOME
        }
      },
      create: {
        guildId: params.guildId,
        module: ModuleKey.WELCOME,
        enabled: settings.enabled
      },
      update: {
        enabled: settings.enabled
      }
    })
  ]);

  await prisma.auditLog.create({
    data: {
      guildId: params.guildId,
      actorUserId: access.session.user.discordId,
      action: "DASHBOARD_WELCOME_SETTINGS_UPDATE",
      targetType: "WelcomeConfig",
      targetId: welcomeConfig.id
    }
  });

  return NextResponse.json({
    welcomeConfig
  });
}
