import { NextResponse } from "next/server";

import { AutomationTrigger, Prisma } from "@guildforge/database";
import {
  automationTestSchema,
  evaluateAutomationConditions
} from "@guildforge/shared";

import { requireGuildApiAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: { guildId: string };
};

export async function POST(request: Request, { params }: RouteContext) {
  const access = await requireGuildApiAccess(params.guildId);

  if (!access.ok) {
    return access.response;
  }

  const parsed = automationTestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "測試資料無效",
        issues: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  let ruleId: string | null = null;

  if (parsed.data.rule.id) {
    const rule = await prisma.automationRule.findFirst({
      where: {
        id: parsed.data.rule.id,
        guildId: params.guildId
      },
      select: { id: true }
    });

    if (!rule) {
      return NextResponse.json({ error: "找不到自動化規則" }, { status: 404 });
    }

    ruleId = rule.id;
  }

  const result = evaluateAutomationConditions(parsed.data.rule.conditions, {
    content: parsed.data.sample.content,
    channelId: parsed.data.sample.channelId,
    roleIds: parsed.data.sample.roleIds,
    occurredAt: parsed.data.sample.occurredAt
  });
  const actionTypes = parsed.data.rule.actions.map((action) => action.type);

  await prisma.automationExecution.create({
    data: {
      guildId: params.guildId,
      ruleId,
      trigger: parsed.data.rule.trigger as AutomationTrigger,
      status: "TEST",
      actorUserId: access.session.user.discordId,
      channelId: parsed.data.sample.channelId,
      details: {
        matched: result.matched,
        failures: result.failures,
        actions: actionTypes
      } as Prisma.InputJsonValue
    }
  });

  return NextResponse.json({
    matched: result.matched,
    failures: result.failures,
    actions: actionTypes
  });
}
