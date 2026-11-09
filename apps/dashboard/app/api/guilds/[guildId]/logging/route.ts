import { NextResponse } from "next/server";

import { LogEvent, ModuleKey } from "@guildforge/database";
import { loggingSettingsSchema } from "@guildforge/shared";

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

  const parsed = loggingSettingsSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "伺服器紀錄設定格式不正確" }, { status: 400 });
  }

  const input = parsed.data;

  await prisma.$transaction([
    prisma.moduleConfig.upsert({
      where: {
        guildId_module: {
          guildId: params.guildId,
          module: ModuleKey.LOGGING
        }
      },
      create: {
        guildId: params.guildId,
        module: ModuleKey.LOGGING,
        enabled: true
      },
      update: {}
    }),
    ...input.configs.map((config) =>
      prisma.logConfig.upsert({
        where: {
          guildId_event: {
            guildId: params.guildId,
            event: config.event as LogEvent
          }
        },
        create: {
          guildId: params.guildId,
          event: config.event as LogEvent,
          enabled: config.enabled,
          channelId: config.channelId
        },
        update: {
          enabled: config.enabled,
          channelId: config.channelId
        }
      })
    )
  ]);

  await prisma.auditLog.create({
    data: {
      guildId: params.guildId,
      actorUserId: access.session.user.discordId,
      action: "DASHBOARD_LOGGING_SETTINGS_UPDATE",
      targetType: "LogConfig",
      metadata: {
        events: input.configs.map((config) => config.event)
      }
    }
  });

  return NextResponse.json({
    configs: input.configs
  });
}
