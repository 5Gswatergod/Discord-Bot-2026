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
import { handleTicketButton } from "../lib/tickets/tickets";
import { handlePollButton } from "../lib/polls/polls";
import { handleGiveawayButton } from "../lib/giveaways/giveaways";
import { logger } from "../lib/logger";

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

test("poll and giveaway buttons acknowledge before database IO, including ended records", async () => {
  for (const [customId, handler, model] of [
    ["poll:poll-1:option-1", handlePollButton, "poll"],
    ["gw:giveaway-1", handleGiveawayButton, "giveaway"]
  ] as const) {
    let acknowledged = false;
    const replies: string[] = [];
    const interaction = {
      customId,
      inGuild: () => true,
      deferReply: async () => {
        acknowledged = true;
      },
      editReply: async ({ content }: { content: string }) => {
        replies.push(content);
      }
    };
    const context = {
      prisma: {
        [model]: {
          findUnique: async () => {
            assert.equal(acknowledged, true);
            return null;
          }
        }
      }
    };
    assert.equal(await handler(interaction as never, context as never), true);
    assert.match(replies[0]!, /已結束|已經結束/);
  }
});

test("all ticket buttons acknowledge before IO and preserve private early-exit messages", async () => {
  for (const customId of ["ticket:open", "ticket:claim:ticket-1", "ticket:close:ticket-1"]) {
    let acknowledged = false;
    const replies: Array<{ content: string; ephemeral: boolean }> = [];
    const check = () => {
      assert.equal(acknowledged, true);
    };
    const interaction = {
      customId,
      guildId: "guild-1",
      channelId: "channel-1",
      user: { id: "user-1" },
      inGuild: () => true,
      guild: {
        members: {
          fetch: async () => {
            check();
            return { permissions: { has: () => false }, roles: { cache: new Map() } };
          }
        }
      },
      deferUpdate: async () => {
        acknowledged = true;
      },
      followUp: async (reply: { content: string; ephemeral: boolean }) => {
        replies.push(reply);
      }
    };
    const context = {
      prisma: {
        moduleConfig: {
          findUnique: async () => {
            check();
            return { enabled: false, settings: {} };
          }
        },
        ticket: {
          findFirst: async () => {
            check();
            return null;
          }
        }
      },
      logger
    };
    assert.equal(await handleTicketButton(interaction as never, context as never), true);
    assert.equal(replies.length, 1);
    assert.equal(replies[0]!.ephemeral, true);
  }
});

test("error logs retain diagnostic fields without serializing Discord request bodies", (t) => {
  const output = t.mock.method(console, "error", () => undefined);
  const error = Object.assign(new Error("Missing Permissions"), {
    code: 50013,
    status: 403,
    requestBody: { token: "must-not-log" }
  });
  logger.error("Interaction failed", { error });
  const payload = JSON.parse(output.mock.calls[0]!.arguments[0] as unknown as string);
  assert.equal(payload.metadata.error.message, "Missing Permissions");
  assert.equal(payload.metadata.error.code, 50013);
  assert.equal(payload.metadata.error.status, 403);
  assert.match(payload.metadata.error.stack, /Missing Permissions/);
  assert.equal(payload.metadata.error.requestBody, undefined);
});
