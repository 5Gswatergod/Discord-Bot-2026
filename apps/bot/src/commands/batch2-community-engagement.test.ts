import assert from "node:assert/strict";
import test from "node:test";

import { PermissionFlagsBits } from "discord.js";

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
