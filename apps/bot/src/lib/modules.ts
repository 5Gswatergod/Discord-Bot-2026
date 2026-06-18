import { ModuleKey, type DatabaseClient } from "@guildforge/database";
import type { GuildModuleKey } from "@guildforge/shared";

export async function isGuildModuleEnabled(
  prisma: DatabaseClient,
  guildId: string,
  module: GuildModuleKey
) {
  const config = await prisma.moduleConfig.findUnique({
    where: {
      guildId_module: {
        guildId,
        module: module as ModuleKey
      }
    },
    select: {
      enabled: true
    }
  });

  return config?.enabled ?? false;
}

export async function getGuildModuleSettings(
  prisma: DatabaseClient,
  guildId: string,
  module: GuildModuleKey
) {
  const config = await prisma.moduleConfig.findUnique({
    where: {
      guildId_module: {
        guildId,
        module: module as ModuleKey
      }
    },
    select: {
      enabled: true,
      settings: true
    }
  });

  return config ?? { enabled: false, settings: null };
}
