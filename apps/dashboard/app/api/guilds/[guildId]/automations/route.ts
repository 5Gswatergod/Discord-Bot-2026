import { NextResponse } from "next/server";

import {
  AutomationTrigger,
  ModuleKey,
  Prisma
} from "@guildforge/database";
import { automationRulesUpdateSchema } from "@guildforge/shared";

import { requireGuildApiAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: { guildId: string };
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const access = await requireGuildApiAccess(params.guildId);

  if (!access.ok) {
    return access.response;
  }

  const parsed = automationRulesUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "自動化規則設定無效",
        issues: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const ids = [...new Set(parsed.data.rules.map((rule) => rule.id).filter(Boolean))] as string[];

  if (ids.length > 0) {
    const ownedCount = await prisma.automationRule.count({
      where: {
        guildId: params.guildId,
        id: { in: ids }
      }
    });

    if (ownedCount !== ids.length) {
      return NextResponse.json({ error: "找不到部分自動化規則" }, { status: 404 });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.moduleConfig.upsert({
      where: {
        guildId_module: {
          guildId: params.guildId,
          module: ModuleKey.AUTOMATIONS
        }
      },
      create: {
        guildId: params.guildId,
        module: ModuleKey.AUTOMATIONS,
        enabled: true
      },
      update: {}
    });

    await tx.automationRule.deleteMany({
      where: {
        guildId: params.guildId,
        ...(ids.length > 0 ? { id: { notIn: ids } } : {})
      }
    });

    for (const id of ids) {
      await tx.automationRule.update({
        where: { id },
        data: {
          name: `${"_".repeat(100)}hydrava_pending_${id}`
        }
      });
    }

    for (const [position, rule] of parsed.data.rules.entries()) {
      const data = {
        name: rule.name,
        description: rule.description,
        trigger: rule.trigger as AutomationTrigger,
        triggerConfig: rule.triggerConfig as Prisma.InputJsonValue,
        conditions: rule.conditions as Prisma.InputJsonValue,
        actions: rule.actions as Prisma.InputJsonValue,
        position,
        enabled: rule.enabled,
        stopProcessing: rule.stopProcessing,
        cooldownSeconds: rule.cooldownSeconds
      };

      if (rule.id) {
        await tx.automationRule.update({
          where: { id: rule.id },
          data
        });
      } else {
        await tx.automationRule.create({
          data: {
            guildId: params.guildId,
            ...data
          }
        });
      }
    }

    await tx.auditLog.create({
      data: {
        guildId: params.guildId,
        actorUserId: access.session.user.discordId,
        action: "DASHBOARD_AUTOMATIONS_UPDATE",
        targetType: "AutomationRule",
        metadata: {
          ruleCount: parsed.data.rules.length
        }
      }
    });
  });

  return NextResponse.json({ rules: parsed.data.rules });
}
