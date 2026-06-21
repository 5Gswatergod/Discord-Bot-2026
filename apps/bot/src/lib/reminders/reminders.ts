import type { Reminder } from "@guildforge/database";

import type { CommandContext } from "../../commands/types";
import { isSendableGuildTextChannel } from "../channels";
import { isGuildModuleEnabled } from "../modules";

async function deliverReminder(context: CommandContext, reminder: Reminder) {
  const moduleEnabled = await isGuildModuleEnabled(context.prisma, reminder.guildId, "REMINDERS");

  if (!moduleEnabled) {
    return;
  }

  const claim = await context.prisma.reminder.updateMany({
    where: {
      id: reminder.id,
      enabled: true,
      nextRunAt: reminder.nextRunAt
    },
    data: {
      nextRunAt: new Date(Date.now() + 300_000)
    }
  });

  if (claim.count === 0) {
    return;
  }

  const guild = context.client.guilds.cache.get(reminder.guildId);
  const channel = guild ? await guild.channels.fetch(reminder.channelId).catch(() => null) : null;

  if (!isSendableGuildTextChannel(channel)) {
    await context.prisma.reminder.update({
      where: { id: reminder.id },
      data: {
        enabled: false
      }
    });
    return;
  }

  await channel.send(reminder.message);
  const now = new Date();

  await context.prisma.reminder.update({
    where: { id: reminder.id },
    data: reminder.intervalSeconds
      ? {
          lastRunAt: now,
          nextRunAt: new Date(now.getTime() + reminder.intervalSeconds * 1000)
        }
      : {
          lastRunAt: now,
          enabled: false
        }
  });
}

export async function checkDueReminders(context: CommandContext) {
  const reminders = await context.prisma.reminder.findMany({
    where: {
      enabled: true,
      nextRunAt: {
        lte: new Date()
      }
    },
    orderBy: { nextRunAt: "asc" },
    take: 50
  });

  for (const reminder of reminders) {
    await deliverReminder(context, reminder).catch(async (error) => {
      context.logger.warn("Failed to deliver reminder", {
        reminderId: reminder.id,
        error
      });
      await context.prisma.reminder
        .update({
          where: { id: reminder.id },
          data: {
            nextRunAt: new Date(Date.now() + 300_000)
          }
        })
        .catch(() => null);
    });
  }
}
