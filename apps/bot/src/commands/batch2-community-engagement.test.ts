import assert from "node:assert/strict";
import test from "node:test";

import { ChannelType, PermissionFlagsBits } from "discord.js";

import {
  achievementSettingsSchema,
  birthdaySettingsSchema,
  serverStatsUpdateSchema,
  starboardSettingsSchema,
  temporaryVoiceSettingsSchema
} from "@guildforge/shared";

import { daysUntilBirthday, isValidBirthday } from "../lib/birthdays/birthdays";
import { achievementCommands } from "./achievements/achievements";
import { birthdayCommands } from "./birthdays/birthday";
import { serverStatsCommands } from "./server-stats/server-stats";
import { temporaryVoiceCommands } from "./temporary-voice/voice";
import { reconcileTemporaryVoiceChannels } from "../lib/temporary-voice/temporary-voice";

test("serializes unique batch two slash command names", () => {
  const commands = [
    ...achievementCommands,
    ...birthdayCommands,
    ...serverStatsCommands,
    ...temporaryVoiceCommands
  ];
  const payloads = commands.map((command) => command.data.toJSON());
  const names = payloads.map((command) => command.name);

  assert.equal(new Set(names).size, names.length);
  assert.deepEqual(names, ["achievements", "birthday", "server-stats", "voice"]);
  assert.ok(payloads.every((payload) => payload.dm_permission === false));
  assert.equal(
    payloads.find((payload) => payload.name === "server-stats")?.default_member_permissions,
    PermissionFlagsBits.ManageGuild.toString()
  );
});

test("provides safe defaults for batch two module settings", () => {
  assert.equal(starboardSettingsSchema.parse({}).threshold, 3);
  assert.equal(achievementSettingsSchema.parse({}).achievements.length, 0);
  assert.equal(birthdaySettingsSchema.parse({}).timeZone, "Asia/Taipei");
  assert.equal(temporaryVoiceSettingsSchema.parse({}).userLimit, 0);
});

test("rejects duplicate achievement names and server statistic types", () => {
  assert.equal(
    achievementSettingsSchema.safeParse({
      achievements: [
        { name: "常客", trigger: "MESSAGE_COUNT", threshold: 100 },
        { name: "常客", trigger: "LEVEL", threshold: 5 }
      ]
    }).success,
    false
  );
  assert.equal(
    serverStatsUpdateSchema.safeParse({
      channels: [
        { type: "MEMBER_COUNT", template: "成員：{count}" },
        { type: "MEMBER_COUNT", template: "總數：{count}" }
      ]
    }).success,
    false
  );
});

test("validates birthdays and calculates upcoming days", () => {
  assert.equal(isValidBirthday(2, 29, 2024), true);
  assert.equal(isValidBirthday(2, 29, 2025), false);
  assert.equal(isValidBirthday(4, 31), false);
  assert.equal(
    daysUntilBirthday(6, 25, "Asia/Taipei", new Date("2026-06-22T04:00:00.000Z")),
    3
  );
});

test("reconciles empty, missing, and active temporary voice channels", async () => {
  const removedRecordIds: string[] = [];
  const deletedChannelIds: string[] = [];
  const records = [
    {
      id: "empty",
      guildId: "guild",
      channelId: "empty-channel",
      ownerUserId: "owner-1",
      createdAt: new Date()
    },
    {
      id: "active",
      guildId: "guild",
      channelId: "active-channel",
      ownerUserId: "owner-2",
      createdAt: new Date()
    },
    {
      id: "missing",
      guildId: "guild",
      channelId: "missing-channel",
      ownerUserId: "owner-3",
      createdAt: new Date()
    }
  ];
  const channels = new Map([
    [
      "empty-channel",
      {
        id: "empty-channel",
        type: ChannelType.GuildVoice,
        members: new Map(),
        delete: async () => {
          deletedChannelIds.push("empty-channel");
        }
      }
    ],
    [
      "active-channel",
      {
        id: "active-channel",
        type: ChannelType.GuildVoice,
        members: new Map([["member", {}]]),
        delete: async () => {
          deletedChannelIds.push("active-channel");
        }
      }
    ]
  ]);
  const context = {
    prisma: {
      temporaryVoiceChannel: {
        findMany: async () => records,
        deleteMany: async ({ where }: { where: { id: string } }) => {
          removedRecordIds.push(where.id);
        }
      }
    },
    client: {
      guilds: {
        cache: new Map([
          [
            "guild",
            {
              id: "guild",
              channels: {
                fetch: async (channelId: string) => channels.get(channelId) ?? null
              }
            }
          ]
        ])
      }
    },
    logger: {
      info: () => undefined,
      warn: () => undefined
    }
  };

  const summary = await reconcileTemporaryVoiceChannels(context as never);

  assert.deepEqual(deletedChannelIds, ["empty-channel"]);
  assert.deepEqual(removedRecordIds.sort(), ["empty", "missing"]);
  assert.equal(summary.deleted, 1);
  assert.equal(summary.active, 1);
  assert.equal(summary.missing, 1);
});
