import { NextResponse } from "next/server";

import { AutoModPunishment, AutoModTrigger, ModuleKey } from "@guildforge/database";
import { autoModTriggerLabels, autoModUpdateSchema } from "@guildforge/shared";

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

  const parsed = autoModUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "自動管理規則格式不正確" }, { status: 400 });
  }

  const input = parsed.data;

  await prisma.$transaction([
    prisma.moduleConfig.upsert({
      where: {
        guildId_module: {
          guildId: params.guildId,
          module: ModuleKey.AUTO_MODERATION
        }
      },
      create: {
        guildId: params.guildId,
        module: ModuleKey.AUTO_MODERATION,
        enabled: true
      },
      update: {}
    }),
    ...input.rules.map((rule) =>
      prisma.autoModRule.upsert({
        where: {
          guildId_name: {
            guildId: params.guildId,
            name: rule.trigger
          }
        },
        create: {
          guildId: params.guildId,
          name: rule.trigger,
          trigger: rule.trigger as AutoModTrigger,
          enabled: rule.enabled,
          pattern: rule.pattern,
          ignoredChannelIds: rule.ignoredChannelIds,
          ignoredRoleIds: rule.ignoredRoleIds,
          punishment: rule.punishment as AutoModPunishment,
          punishmentDurationSeconds: rule.punishmentDurationSeconds
        },
        update: {
          enabled: rule.enabled,
          pattern: rule.pattern,
          ignoredChannelIds: rule.ignoredChannelIds,
          ignoredRoleIds: rule.ignoredRoleIds,
          punishment: rule.punishment as AutoModPunishment,
          punishmentDurationSeconds: rule.punishmentDurationSeconds
        }
      })
    )
  ]);

  await prisma.auditLog.create({
    data: {
      guildId: params.guildId,
      actorUserId: access.session.user.discordId,
      action: "DASHBOARD_AUTOMOD_SETTINGS_UPDATE",
      targetType: "AutoModRule",
      metadata: {
        rules: input.rules.map((rule) => autoModTriggerLabels[rule.trigger])
      }
    }
  });

  return NextResponse.json({
    rules: input.rules
  });
}
