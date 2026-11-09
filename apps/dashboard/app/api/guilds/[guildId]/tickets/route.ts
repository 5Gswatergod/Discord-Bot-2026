import { NextResponse } from "next/server";

import { ModuleKey } from "@guildforge/database";
import { ticketSettingsSchema } from "@guildforge/shared";

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

  const parsed = ticketSettingsSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "客服單設定格式不正確" }, { status: 400 });
  }

  const existing = await prisma.moduleConfig.findUnique({
    where: {
      guildId_module: {
        guildId: params.guildId,
        module: ModuleKey.TICKETS
      }
    },
    select: { settings: true }
  });
  const existingSettings =
    typeof existing?.settings === "object" && existing.settings !== null
      ? (existing.settings as Record<string, unknown>)
      : {};

  await prisma.$transaction([
    prisma.moduleConfig.upsert({
      where: {
        guildId_module: {
          guildId: params.guildId,
          module: ModuleKey.TICKETS
        }
      },
      create: {
        guildId: params.guildId,
        module: ModuleKey.TICKETS,
        enabled: true,
        settings: {
          ...existingSettings,
          ...parsed.data
        }
      },
      update: {
        settings: {
          ...existingSettings,
          ...parsed.data
        }
      }
    }),
    prisma.auditLog.create({
      data: {
        guildId: params.guildId,
        actorUserId: access.session.user.discordId,
        action: "DASHBOARD_TICKET_SETTINGS_UPDATE",
        targetType: "TicketSettings"
      }
    })
  ]);

  return NextResponse.json({ settings: parsed.data });
}
