import { birthdaySettingsSchema, formatTemplate } from "@guildforge/shared";

import type { CommandContext } from "../../commands/types";
import { isSendableGuildTextChannel } from "../channels";

export function isValidBirthday(month: number, day: number, year?: number | null) {
  const validationYear = year ?? 2000;
  const date = new Date(Date.UTC(validationYear, month - 1, day));

  return (
    date.getUTCFullYear() === validationYear &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function localDateParts(timeZone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric"
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.get("year")),
    month: Number(values.get("month")),
    day: Number(values.get("day"))
  };
}

export function daysUntilBirthday(
  month: number,
  day: number,
  timeZone: string,
  now = new Date()
) {
  const current = localDateParts(timeZone, now);
  const today = Date.UTC(current.year, current.month - 1, current.day);
  let targetYear = current.year;
  let target = Date.UTC(targetYear, month - 1, day);

  while (
    target < today ||
    new Date(target).getUTCMonth() !== month - 1 ||
    new Date(target).getUTCDate() !== day
  ) {
    targetYear += 1;
    target = Date.UTC(targetYear, month - 1, day);
  }

  return Math.round((target - today) / 86_400_000);
}

export async function checkBirthdays(context: CommandContext) {
  const configs = await context.prisma.moduleConfig.findMany({
    where: {
      module: "BIRTHDAYS",
      enabled: true
    }
  });

  for (const config of configs) {
    try {
      const settings = birthdaySettingsSchema.parse(config.settings ?? {});

      if (!settings.announcementChannelId) {
        continue;
      }

      const current = localDateParts(settings.timeZone);
      const birthdays = await context.prisma.birthday.findMany({
        where: {
          guildId: config.guildId,
          month: current.month,
          day: current.day,
          OR: [
            { lastCelebratedYear: null },
            { lastCelebratedYear: { not: current.year } }
          ]
        }
      });
      const guild = context.client.guilds.cache.get(config.guildId);
      const channel = guild
        ? await guild.channels.fetch(settings.announcementChannelId).catch(() => null)
        : null;

      if (!guild || !isSendableGuildTextChannel(channel)) {
        continue;
      }

      for (const birthday of birthdays) {
        const claimed = await context.prisma.birthday.updateMany({
          where: {
            id: birthday.id,
            OR: [
              { lastCelebratedYear: null },
              { lastCelebratedYear: { not: current.year } }
            ]
          },
          data: {
            lastCelebratedYear: current.year
          }
        });

        if (claimed.count === 0) {
          continue;
        }

        try {
          const member = await guild.members.fetch(birthday.userId).catch(() => null);
          const age =
            birthday.year && birthday.year <= current.year
              ? current.year - birthday.year
              : null;

          await channel.send({
            content: formatTemplate(settings.announcementMessage, {
              user: `<@${birthday.userId}>`,
              username: member?.user.username ?? birthday.userId,
              server: guild.name,
              age: age ?? ""
            }),
            allowedMentions: {
              users: [birthday.userId]
            }
          });
        } catch (error) {
          await context.prisma.birthday.update({
            where: { id: birthday.id },
            data: {
              lastCelebratedYear: birthday.lastCelebratedYear
            }
          });
          throw error;
        }
      }
    } catch (error) {
      context.logger.warn("Failed to process birthdays", {
        guildId: config.guildId,
        error
      });
    }
  }
}
