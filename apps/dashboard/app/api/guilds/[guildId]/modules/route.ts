import { NextResponse } from "next/server";

import { ModuleKey } from "@guildforge/database";
import { moduleToggleSchema } from "@guildforge/shared";

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

  const parsed = moduleToggleSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "模組設定格式不正確" }, { status: 400 });
  }

  const input = parsed.data;

  const moduleConfig = await prisma.moduleConfig.upsert({
    where: {
      guildId_module: {
        guildId: params.guildId,
        module: input.module as ModuleKey
      }
    },
    create: {
      guildId: params.guildId,
      module: input.module as ModuleKey,
      enabled: input.enabled
    },
    update: {
      enabled: input.enabled
    }
  });

  await prisma.auditLog.create({
    data: {
      guildId: params.guildId,
      actorUserId: access.session.user.discordId,
      action: "DASHBOARD_MODULE_TOGGLE",
      targetType: "ModuleConfig",
      targetId: moduleConfig.id,
      metadata: {
        module: input.module,
        enabled: input.enabled
      }
    }
  });

  return NextResponse.json({
    moduleConfig
  });
}
