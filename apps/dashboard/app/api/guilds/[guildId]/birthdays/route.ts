import { NextResponse } from "next/server";

import { ModuleKey } from "@guildforge/database";
import { birthdaySettingsSchema } from "@guildforge/shared";

import { requireGuildApiAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: { guildId: string };
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const access = await requireGuildApiAccess(params.guildId);

  if (!access.ok) return access.response;

  const parsed = birthdaySettingsSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "生日設定格式不正確" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.moduleConfig.upsert({
      where: {
        guildId_module: {
          guildId: params.guildId,
          module: ModuleKey.BIRTHDAYS
        }
      },
      create: {
        guildId: params.guildId,
        module: ModuleKey.BIRTHDAYS,
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
        action: "DASHBOARD_BIRTHDAYS_UPDATE",
        targetType: "BirthdaySettings"
      }
    })
  ]);

  return NextResponse.json({ settings: parsed.data });
}
