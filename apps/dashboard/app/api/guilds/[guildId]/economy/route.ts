import { NextResponse } from "next/server";

import { ModuleKey } from "@guildforge/database";
import { economyUpdateSchema } from "@guildforge/shared";

import { requireGuildApiAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: {
    guildId: string;
  };
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const access = await requireGuildApiAccess(params.guildId);

  if (!access.ok) {
    return access.response;
  }

  const parsed = economyUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "經濟系統設定格式不正確" }, { status: 400 });
  }

  const moduleConfig = await prisma.moduleConfig.upsert({
    where: {
      guildId_module: {
        guildId: params.guildId,
        module: ModuleKey.ECONOMY
      }
    },
    create: {
      guildId: params.guildId,
      module: ModuleKey.ECONOMY,
      enabled: true,
      settings: parsed.data
    },
    update: {
      settings: parsed.data
    }
  });

  await prisma.auditLog.create({
    data: {
      guildId: params.guildId,
      actorUserId: access.session.user.discordId,
      action: "DASHBOARD_ECONOMY_SETTINGS_UPDATE",
      targetType: "ModuleConfig",
      targetId: moduleConfig.id
    }
  });

  return NextResponse.json({ settings: parsed.data });
}
