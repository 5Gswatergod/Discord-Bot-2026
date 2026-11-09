import { NextResponse } from "next/server";

import { ModuleKey } from "@guildforge/database";
import { remindersUpdateSchema } from "@guildforge/shared";

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

  const parsed = remindersUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "提醒設定格式不正確" }, { status: 400 });
  }

  const ids = [
    ...new Set(parsed.data.reminders.map((reminder) => reminder.id).filter(Boolean))
  ] as string[];

  if (ids.length > 0) {
    const ownedCount = await prisma.reminder.count({
      where: {
        guildId: params.guildId,
        id: { in: ids }
      }
    });

    if (ownedCount !== ids.length) {
      return NextResponse.json({ error: "找不到提醒" }, { status: 404 });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.moduleConfig.upsert({
      where: {
        guildId_module: {
          guildId: params.guildId,
          module: ModuleKey.REMINDERS
        }
      },
      create: {
        guildId: params.guildId,
        module: ModuleKey.REMINDERS,
        enabled: true
      },
      update: {}
    });

    for (const reminder of parsed.data.reminders) {
      const data = {
        channelId: reminder.channelId,
        message: reminder.message,
        nextRunAt: reminder.nextRunAt,
        intervalSeconds: reminder.intervalSeconds,
        enabled: reminder.enabled
      };

      if (reminder.id) {
        await tx.reminder.update({
          where: { id: reminder.id },
          data
        });
      } else {
        await tx.reminder.create({
          data: {
            guildId: params.guildId,
            createdByUserId: access.session.user.discordId ?? "dashboard",
            ...data
          }
        });
      }
    }

    await tx.auditLog.create({
      data: {
        guildId: params.guildId,
        actorUserId: access.session.user.discordId,
        action: "DASHBOARD_REMINDERS_UPDATE",
        targetType: "Reminder"
      }
    });
  });

  return NextResponse.json({ reminders: parsed.data.reminders });
}
