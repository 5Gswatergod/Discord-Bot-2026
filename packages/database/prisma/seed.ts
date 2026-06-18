import { ModuleKey, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const demoGuildId = "000000000000000001";

  await prisma.guild.upsert({
    where: { id: demoGuildId },
    create: {
      id: demoGuildId,
      name: "GuildForge Demo",
      memberCount: 42,
      botJoinedAt: new Date(),
      config: {
        create: {
          locale: "zh-TW",
          commandPrefix: "!"
        }
      }
    },
    update: {
      name: "GuildForge Demo",
      memberCount: 42
    }
  });

  for (const module of Object.values(ModuleKey)) {
    await prisma.moduleConfig.upsert({
      where: {
        guildId_module: {
          guildId: demoGuildId,
          module
        }
      },
      create: {
        guildId: demoGuildId,
        module,
        enabled: ["MODERATION", "LOGGING", "WELCOME"].includes(module)
      },
      update: {}
    });
  }

  await prisma.welcomeConfig.upsert({
    where: { guildId: demoGuildId },
    create: {
      guildId: demoGuildId,
      enabled: true,
      welcomeMessage: "歡迎 {user} 加入 {server}，目前共有 {memberCount} 位成員。"
    },
    update: {}
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
