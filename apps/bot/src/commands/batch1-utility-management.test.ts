import assert from "node:assert/strict";
import test from "node:test";

import {
  embedMessageInputSchema,
  inviteTrackingSettingsSchema,
  reminderInputSchema,
  ticketSettingsSchema
} from "@guildforge/shared";

import { inviteTrackingCommands } from "./invite-tracking/invites";
import { reminderCommand } from "./reminders/reminder";
import { ticketCommand } from "./tickets/ticket";

test("serializes unique batch one slash command names", () => {
  const commands = [ticketCommand, ...inviteTrackingCommands, reminderCommand];
  const payloads = commands.map((command) => command.data.toJSON());
  const names = payloads.map((command) => command.name);

  assert.equal(new Set(names).size, names.length);
  assert.deepEqual(names, ["ticket", "invites", "invite-leaderboard", "reminder"]);
  assert.ok(payloads.every((payload) => payload.dm_permission === false));
});

test("provides safe defaults for ticket and invite tracking settings", () => {
  const tickets = ticketSettingsSchema.parse({});
  const invites = inviteTrackingSettingsSchema.parse({});

  assert.equal(tickets.maxOpenPerUser, 1);
  assert.deepEqual(tickets.supportRoleIds, []);
  assert.equal(invites.trackBots, false);
});

test("requires embed content and validates recurring reminders", () => {
  assert.equal(
    embedMessageInputSchema.safeParse({
      channelId: "12345",
      color: "#24b47e",
      enabled: true
    }).success,
    false
  );
  assert.equal(
    reminderInputSchema.safeParse({
      channelId: "12345",
      message: "test",
      nextRunAt: new Date(),
      intervalSeconds: 30,
      enabled: true
    }).success,
    false
  );
});
