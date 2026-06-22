import { NextResponse } from "next/server";

import {
  ModuleKey,
  ReactionRoleMode,
  ReactionRoleOptionType
} from "@guildforge/database";
import { reactionRolePanelsUpdateSchema } from "@guildforge/shared";

import { requireGuildApiAccess } from "@/lib/api-auth";
import { getDiscordGuildResources } from "@/lib/discord-resources";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: {
    guildId: string;
  };
};

const textChannelTypes = new Set([0, 5, 15, 16]);

function serializePanels(
  panels: Array<{
    id: string;
    channelId: string;
    publishedChannelId: string | null;
    messageId: string | null;
    title: string;
    description: string | null;
    color: string;
    mode: ReactionRoleMode;
    enabled: boolean;
    lastSyncedAt: Date | null;
    lastSyncError: string | null;
    options: Array<{
      id: string;
      type: ReactionRoleOptionType;
      roleId: string;
      emoji: string | null;
      label: string;
      sortOrder: number;
    }>;
  }>
) {
  return panels.map((panel) => ({
    id: panel.id,
    channelId: panel.channelId,
    publishedChannelId: panel.publishedChannelId,
    messageId: panel.messageId,
    title: panel.title,
    description: panel.description,
    color: panel.color,
    mode: panel.mode,
    enabled: panel.enabled,
    lastSyncedAt: panel.lastSyncedAt?.toISOString() ?? null,
    lastSyncError: panel.lastSyncError,
    syncPending:
      Boolean(panel.lastSyncError) ||
      (panel.enabled ? !panel.lastSyncedAt : Boolean(panel.messageId)),
    options: panel.options.map((option) => ({
      id: option.id,
      type: option.type,
      roleId: option.roleId,
      emoji: option.emoji,
      label: option.label,
      sortOrder: option.sortOrder
    }))
  }));
}

async function loadPanels(guildId: string) {
  return prisma.reactionRolePanel.findMany({
    where: {
      guildId,
      deletedAt: null
    },
    include: {
      options: {
        orderBy: {
          sortOrder: "asc"
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  });
}

export async function GET(_request: Request, { params }: RouteContext) {
  const access = await requireGuildApiAccess(params.guildId);

  if (!access.ok) {
    return access.response;
  }

  return NextResponse.json({
    panels: serializePanels(await loadPanels(params.guildId))
  });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const access = await requireGuildApiAccess(params.guildId);

  if (!access.ok) {
    return access.response;
  }

  const parsed = reactionRolePanelsUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "自助身分組面板格式不正確"
      },
      { status: 400 }
    );
  }

  const resources = await getDiscordGuildResources(params.guildId).catch(() => null);

  if (!resources) {
    return NextResponse.json(
      { error: "目前無法驗證 Discord 頻道與身分組" },
      { status: 502 }
    );
  }

  const channelIds = new Set(
    resources.channels
      .filter((channel) => textChannelTypes.has(channel.type))
      .map((channel) => channel.id)
  );
  const roleIds = new Set(
    resources.roles.filter((role) => role.assignable).map((role) => role.id)
  );
  const invalidResources = parsed.data.panels.some(
    (panel) =>
      !channelIds.has(panel.channelId) ||
      panel.options.some((option) => !roleIds.has(option.roleId))
  );

  if (invalidResources) {
    return NextResponse.json(
      { error: "面板包含已刪除、無法存取或機器人無法指派的 Discord 資源" },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const panelIds = input.panels.flatMap((panel) => (panel.id ? [panel.id] : []));
  const existingPanels =
    panelIds.length > 0
      ? await prisma.reactionRolePanel.findMany({
          where: {
            guildId: params.guildId,
            id: { in: panelIds },
            deletedAt: null
          },
          include: {
            options: true
          }
        })
      : [];

  if (existingPanels.length !== panelIds.length) {
    return NextResponse.json({ error: "找不到自助身分組面板" }, { status: 404 });
  }

  const panelOptionMap = new Map(
    existingPanels.map((panel) => [
      panel.id,
      new Map(panel.options.map((option) => [option.id, option]))
    ])
  );

  for (const panel of input.panels) {
    const submittedOptionIds = panel.options.flatMap((option) =>
      option.id ? [option.id] : []
    );

    if (!panel.id && submittedOptionIds.length > 0) {
      return NextResponse.json({ error: "新面板不可引用既有選項" }, { status: 400 });
    }

    const ownedOptions = panel.id ? panelOptionMap.get(panel.id) : null;

    if (
      submittedOptionIds.some((optionId) => !ownedOptions?.has(optionId))
    ) {
      return NextResponse.json({ error: "找不到自助身分組選項" }, { status: 404 });
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

    await tx.reactionRolePanel.updateMany({
      where: {
        guildId: params.guildId,
        deletedAt: null,
        ...(panelIds.length > 0 ? { id: { notIn: panelIds } } : {})
      },
      data: {
        deletedAt: new Date(),
        lastSyncedAt: null,
        lastSyncError: null
      }
    });

    for (const panel of input.panels) {
      const panelData = {
        channelId: panel.channelId,
        title: panel.title,
        description: panel.description,
        color: panel.color,
        mode: panel.mode as ReactionRoleMode,
        enabled: panel.enabled,
        deletedAt: null,
        lastSyncedAt: null,
        lastSyncError: null
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
      const optionIds = panel.options.flatMap((option) => (option.id ? [option.id] : []));

      await tx.reactionRoleOption.deleteMany({
        where: {
          panelId: savedPanel.id,
          ...(optionIds.length > 0 ? { id: { notIn: optionIds } } : {})
        }
      });

      if (optionIds.length > 0) {
        for (const optionId of optionIds) {
          await tx.reactionRoleOption.update({
            where: { id: optionId },
            data: {
              roleId: `hydrava-pending-${optionId}`
            }
          });
        }
      }

      for (const option of panel.options) {
        const optionData = {
          type: option.type as ReactionRoleOptionType,
          roleId: option.roleId,
          emoji: option.emoji || null,
          label: option.label,
          sortOrder: option.sortOrder
        };

        if (option.id) {
          await tx.reactionRoleOption.update({
            where: { id: option.id },
            data: optionData
          });
        } else {
          await tx.reactionRoleOption.create({
            data: {
              guildId: params.guildId,
              panelId: savedPanel.id,
              ...optionData
            }
          });
        }
      }
    }

    await tx.auditLog.create({
      data: {
        guildId: params.guildId,
        actorUserId: access.session.user.discordId,
        action: "DASHBOARD_REACTION_ROLES_UPDATE",
        targetType: "ReactionRolePanel"
      }
    });
  });

  return NextResponse.json({
    panels: serializePanels(await loadPanels(params.guildId))
  });
}
