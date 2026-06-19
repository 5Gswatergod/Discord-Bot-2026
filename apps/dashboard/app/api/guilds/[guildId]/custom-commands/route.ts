import { NextResponse } from "next/server";

import { CustomCommandType, ModuleKey } from "@guildforge/database";
import { customCommandUpdateSchema } from "@guildforge/shared";

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

  const parsed = customCommandUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "自訂指令格式不正確" }, { status: 400 });
  }

  const input = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.guildConfig.upsert({
      where: {
        guildId: params.guildId
      },
      create: {
        guildId: params.guildId,
        commandPrefix: input.commandPrefix
      },
      update: {
        commandPrefix: input.commandPrefix
      }
    });

    await tx.moduleConfig.upsert({
      where: {
        guildId_module: {
          guildId: params.guildId,
          module: ModuleKey.CUSTOM_COMMANDS
        }
      },
      create: {
        guildId: params.guildId,
        module: ModuleKey.CUSTOM_COMMANDS,
        enabled: true
      },
      update: {}
    });

    const names = input.commands.map((command) => command.name);
    await tx.customCommand.deleteMany({
      where: {
        guildId: params.guildId,
        name: {
          notIn: names.length > 0 ? names : ["__never__"]
        }
      }
    });

    for (const command of input.commands) {
      await tx.customCommand.upsert({
        where: {
          guildId_name: {
            guildId: params.guildId,
            name: command.name
          }
        },
        create: {
          guildId: params.guildId,
          name: command.name,
          description: command.description,
          type: CustomCommandType.PREFIX,
          responseText: command.responseText,
          cooldownSeconds: command.cooldownSeconds,
          allowedRoleIds: command.allowedRoleIds,
          allowedChannelIds: command.allowedChannelIds,
          enabled: command.enabled
        },
        update: {
          description: command.description,
          responseText: command.responseText,
          cooldownSeconds: command.cooldownSeconds,
          allowedRoleIds: command.allowedRoleIds,
          allowedChannelIds: command.allowedChannelIds,
          enabled: command.enabled
        }
      });
    }
  });

  await prisma.auditLog.create({
    data: {
      guildId: params.guildId,
      actorUserId: access.session.user.discordId,
      action: "DASHBOARD_CUSTOM_COMMANDS_UPDATE",
      targetType: "CustomCommand",
      metadata: {
        commands: input.commands.map((command) => command.name)
      }
    }
  });

  return NextResponse.json({
    commandPrefix: input.commandPrefix,
    commands: input.commands
  });
}
