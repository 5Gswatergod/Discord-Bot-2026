import type { Guild as DiscordGuild } from "discord.js";

import { LogEvent, ModuleKey, type DatabaseClient } from "@guildforge/database";
import { logEvents, moduleKeys } from "@guildforge/shared";

export async function ensureGuildDefaults(prisma: DatabaseClient, guild: DiscordGuild) {
  await prisma.guild.upsert({
    where: {
      id: guild.id
    },
    create: {
      id: guild.id,
      name: guild.name,
      icon: guild.icon,
      ownerId: guild.ownerId,
      memberCount: guild.memberCount,
      botJoinedAt: new Date()
    },
    update: {
      name: guild.name,
      icon: guild.icon,
      ownerId: guild.ownerId,
      memberCount: guild.memberCount,
      botJoinedAt: new Date()
    }
  });

  await prisma.guildConfig.upsert({
    where: {
      guildId: guild.id
    },
    create: {
      guildId: guild.id
    },
    update: {}
  });

  await Promise.all(
    moduleKeys.map((module) =>
      prisma.moduleConfig.upsert({
        where: {
          guildId_module: {
            guildId: guild.id,
            module: module as ModuleKey
          }
        },
        create: {
          guildId: guild.id,
          module: module as ModuleKey,
          enabled: false
        },
        update: {}
      })
    )
  );

  await prisma.welcomeConfig.upsert({
    where: {
      guildId: guild.id
    },
    create: {
      guildId: guild.id
    },
    update: {}
  });

  await Promise.all(
    logEvents.map((event) =>
      prisma.logConfig.upsert({
        where: {
          guildId_event: {
            guildId: guild.id,
            event: event as LogEvent
          }
        },
        create: {
          guildId: guild.id,
          event: event as LogEvent,
          enabled: false
        },
        update: {}
      })
    )
  );
}
