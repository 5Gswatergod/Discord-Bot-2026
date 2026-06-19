import { NextResponse } from "next/server";

import { ModuleKey, ReactionRoleMode, ReactionRoleOptionType } from "@guildforge/database";
import { reactionRolePanelsUpdateSchema } from "@guildforge/shared";

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

  const parsed = reactionRolePanelsUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "自助身分組面板格式不正確" }, { status: 400 });
  }

  const input = parsed.data;
  const panelIds = [...new Set(input.panels.map((panel) => panel.id).filter(Boolean))] as string[];

  if (panelIds.length > 0) {
    const ownedPanelCount = await prisma.reactionRolePanel.count({
      where: {
        guildId: params.guildId,
        id: {
          in: panelIds
        }
      }
    });

    if (ownedPanelCount !== panelIds.length) {
      return NextResponse.json({ error: "找不到自助身分組面板" }, { status: 404 });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.moduleConfig.upsert({
      where: {
        guildId_module: {
          guildId: params.guildId,
          module: ModuleKey.REACTION_ROLES
        }
      },
      create: {
        guildId: params.guildId,
        module: ModuleKey.REACTION_ROLES,
        enabled: true
      },
      update: {}
    });

    await tx.reactionRolePanel.deleteMany({
      where: {
        guildId: params.guildId,
        id: {
          notIn: panelIds.length > 0 ? panelIds : ["__never__"]
        }
      }
    });

    for (const panel of input.panels) {
      const panelData = {
        channelId: panel.channelId,
        title: panel.title,
        description: panel.description,
        color: panel.color,
        mode: panel.mode as ReactionRoleMode,
        enabled: panel.enabled
      };
      const savedPanel = panel.id
        ? await tx.reactionRolePanel.update({
            where: {
              id: panel.id
            },
            data: panelData
          })
        : await tx.reactionRolePanel.create({
            data: {
              guildId: params.guildId,
              ...panelData
            }
          });

      await tx.reactionRoleOption.deleteMany({
        where: {
          panelId: savedPanel.id
        }
      });

      await tx.reactionRoleOption.createMany({
        data: panel.options.map((option) => ({
          guildId: params.guildId,
          panelId: savedPanel.id,
          type: option.type as ReactionRoleOptionType,
          roleId: option.roleId,
          emoji: option.emoji,
          label: option.label,
          sortOrder: option.sortOrder
        }))
      });
    }
  });

  await prisma.auditLog.create({
    data: {
      guildId: params.guildId,
      actorUserId: access.session.user.discordId,
      action: "DASHBOARD_REACTION_ROLES_UPDATE",
      targetType: "ReactionRolePanel"
    }
  });

  return NextResponse.json({ panels: input.panels });
}
