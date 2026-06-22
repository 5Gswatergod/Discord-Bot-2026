import assert from "node:assert/strict";
import test from "node:test";

import { ChannelType } from "discord.js";

import {
  reactionRolePanelsUpdateSchema
} from "@guildforge/shared";

import {
  buildReactionRoleSignature,
  syncReactionRolePanels
} from "../lib/reaction-roles/reaction-roles";
import { reactionRoleCommand } from "./reaction-roles/reaction-role";

function panel(overrides: Record<string, unknown> = {}) {
  return {
    id: "panel-1",
    guildId: "guild-1",
    channelId: "channel-1",
    publishedChannelId: "channel-1",
    messageId: "message-1",
    publishedReactionSignature: null,
    title: "身分組",
    description: "選擇身分組",
    color: "#24b47e",
    mode: "MULTI_SELECT",
    enabled: true,
    lastSyncedAt: null,
    lastSyncError: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    options: [
      {
        id: "option-1",
        guildId: "guild-1",
        panelId: "panel-1",
        type: "BUTTON",
        roleId: "12345",
        emoji: null,
        label: "玩家",
        buttonId: null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ],
    ...overrides
  };
}

test("replaces the ID-based publish command with a no-argument sync command", () => {
  const payload = reactionRoleCommand.data.toJSON();
  const subcommand = payload.options?.[0] as
    | { name: string; options?: unknown[] }
    | undefined;

  assert.equal(subcommand?.name, "sync");
  assert.equal(subcommand?.options?.length ?? 0, 0);
  assert.equal(JSON.stringify(payload).includes("panel_id"), false);
});

test("validates unique role and reaction emoji selections", () => {
  const duplicateRole = reactionRolePanelsUpdateSchema.safeParse({
    panels: [
      {
        channelId: "12345",
        title: "Test",
        options: [
          { type: "BUTTON", roleId: "67890", label: "A" },
          { type: "BUTTON", roleId: "67890", label: "B" }
        ]
      }
    ]
  });
  const duplicateReaction = reactionRolePanelsUpdateSchema.safeParse({
    panels: [
      {
        channelId: "12345",
        title: "Test",
        options: [
          { type: "REACTION", roleId: "67890", label: "A", emoji: "⭐" },
          { type: "REACTION", roleId: "67891", label: "B", emoji: "⭐" }
        ]
      }
    ]
  });

  assert.equal(duplicateRole.success, false);
  assert.equal(duplicateReaction.success, false);
});

test("reaction signatures change only with reaction option identity or emoji", () => {
  const base = panel({
    options: [
      {
        ...panel().options[0],
        type: "REACTION",
        emoji: "⭐"
      }
    ]
  });
  const changedLabel = {
    ...base,
    options: [{ ...base.options[0], label: "新名稱" }]
  };
  const changedEmoji = {
    ...base,
    options: [{ ...base.options[0], emoji: "🔥" }]
  };

  assert.equal(
    buildReactionRoleSignature(base as never),
    buildReactionRoleSignature(changedLabel as never)
  );
  assert.notEqual(
    buildReactionRoleSignature(base as never),
    buildReactionRoleSignature(changedEmoji as never)
  );
});

test("edits existing button panels and removes soft-deleted panels", async () => {
  const editedMessageIds: string[] = [];
  const deletedMessageIds: string[] = [];
  const deletedPanelIds: string[] = [];
  const updatedPanelIds: string[] = [];
  const messages = new Map([
    [
      "message-1",
      {
        id: "message-1",
        channelId: "channel-1",
        edit: async () => {
          editedMessageIds.push("message-1");
        },
        delete: async () => {
          deletedMessageIds.push("message-1");
        }
      }
    ],
    [
      "message-2",
      {
        id: "message-2",
        channelId: "channel-1",
        edit: async () => {
          editedMessageIds.push("message-2");
        },
        delete: async () => {
          deletedMessageIds.push("message-2");
        }
      }
    ]
  ]);
  const channel = {
    type: ChannelType.GuildText,
    messages: {
      fetch: async (messageId: string) => messages.get(messageId) ?? null
    },
    send: async () => {
      throw new Error("Existing panels should not create new messages");
    }
  };
  const context = {
    prisma: {
      moduleConfig: {
        findUnique: async () => ({ enabled: true })
      },
      reactionRolePanel: {
        findMany: async () => [
          panel(),
          panel({
            id: "panel-2",
            messageId: "message-2",
            deletedAt: new Date()
          })
        ],
        update: async ({ where }: { where: { id: string } }) => {
          updatedPanelIds.push(where.id);
        },
        delete: async ({ where }: { where: { id: string } }) => {
          deletedPanelIds.push(where.id);
        }
      }
    },
    client: {
      guilds: {
        cache: new Map([
          [
            "guild-1",
            {
              id: "guild-1",
              channels: {
                fetch: async () => channel
              }
            }
          ]
        ])
      }
    },
    logger: {
      warn: () => undefined
    }
  };

  const summary = await syncReactionRolePanels(context as never, "guild-1");

  assert.deepEqual(editedMessageIds, ["message-1"]);
  assert.deepEqual(deletedMessageIds, ["message-2"]);
  assert.deepEqual(deletedPanelIds, ["panel-2"]);
  assert.deepEqual(updatedPanelIds, ["panel-1"]);
  assert.equal(summary.updated, 1);
  assert.equal(summary.deleted, 1);
});
