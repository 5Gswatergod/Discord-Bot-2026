import assert from "node:assert/strict";
import test from "node:test";
import { PermissionFlagsBits } from "discord.js";

import { economyAdminCommand } from "./economy/admin";
import { economyCommand } from "./economy/economy";
import { shopCommand } from "./economy/shop";

const economyCommands = [economyCommand, shopCommand, economyAdminCommand];

test("serializes unique slash command names", () => {
  const payloads = economyCommands.map((command) => command.data.toJSON());
  const names = payloads.map((command) => command.name);

  assert.equal(new Set(names).size, names.length);
  assert.ok(names.includes("economy"));
  assert.ok(names.includes("shop"));
  assert.ok(names.includes("economy-admin"));
});

test("restricts economy administration to members who can manage the guild", () => {
  const payload = economyCommands
    .find((command) => command.data.name === "economy-admin")
    ?.data.toJSON();

  assert.ok(payload);
  assert.equal(payload.default_member_permissions, PermissionFlagsBits.ManageGuild.toString());
  assert.equal(payload.dm_permission, false);
});
