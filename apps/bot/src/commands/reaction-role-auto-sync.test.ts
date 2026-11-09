import assert from "node:assert/strict";
import test, { before } from "node:test";

import { ChannelType, MessageFlags, PermissionFlagsBits } from "discord.js";

import { reactionRolePanelsUpdateSchema } from "@guildforge/shared";

import {
  buildReactionRoleSignature,
  handleReactionRoleButton,
  syncReactionRolePanels
} from "../lib/reaction-roles/reaction-roles";
import { reactionRoleCommand } from "./reaction-roles/reaction-role";

let handleInteractionCreate: typeof import("../events/interaction-create").handleInteractionCreate;

before(async () => {
  // The router imports optional integrations; these tests never connect to them.
  process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
  process.env.DISCORD_CLIENT_ID ??= "test-client";
  process.env.DISCORD_BOT_TOKEN ??= "test-token";
  ({ handleInteractionCreate } = await import("../events/interaction-create"));
});

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
    deletedAt: null as Date | null,
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
  const subcommand = payload.options?.[0] as { name: string; options?: unknown[] } | undefined;

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

function buttonFixture() {
  const savedPanel = panel();
  const roleChanges: Array<[string, string | string[]]> = [];
  const replies: string[] = [];
  const errors: unknown[] = [];
  const heldRoles = new Map<string, object>();
  const roles = new Map([
    ["12345", { id: "12345", editable: true }],
    ["other-role", { id: "other-role", editable: true }]
  ]);
  let manageRoles = true;
  const guild = {
    id: "guild-1",
    members: {
      fetch: async (options: unknown) => {
        assert.equal(interaction.deferred, true, "acknowledge before fetching members");
        assert.deepEqual(options, { user: "user-1", force: true });
        return member;
      },
      fetchMe: async () => ({
        permissions: {
          has: (permission: bigint) => {
            assert.equal(permission, PermissionFlagsBits.ManageRoles);
            return manageRoles;
          }
        }
      })
    },
    roles: {
      cache: roles,
      fetch: async () => roles
    }
  };
  const member = {
    guild,
    roles: {
      cache: heldRoles,
      add: async (id: string) => {
        roleChanges.push(["add", id]);
      },
      remove: async (ids: string | string[]) => {
        roleChanges.push(["remove", ids]);
      }
    }
  };
  const interaction = {
    customId: "rr:option-1",
    guildId: guild.id,
    guild,
    user: { id: "user-1" },
    deferred: false,
    replied: false,
    inGuild: () => true,
    isStringSelectMenu: () => false,
    isButton: () => true,
    deferReply: async (options: unknown) => {
      assert.deepEqual(options, { flags: MessageFlags.Ephemeral });
      interaction.deferred = true;
    },
    editReply: async ({ content }: { content: string }) => {
      replies.push(content);
    }
  };
  const context = {
    music: null,
    prisma: {
      moduleConfig: { findUnique: async () => ({ enabled: true }) },
      reactionRoleOption: {
        findUnique: async () => {
          assert.equal(interaction.deferred, true, "acknowledge before querying the database");
          return { ...savedPanel.options[0], panel: savedPanel };
        }
      }
    },
    logger: {
      error: (...args: unknown[]) => {
        errors.push(args);
      }
    }
  };

  return {
    savedPanel,
    member,
    interaction,
    context,
    roleChanges,
    replies,
    errors,
    roles,
    heldRoles,
    denyManageRoles: () => {
      manageRoles = false;
    }
  };
}

test("acknowledges role buttons before IO and toggles the freshly fetched member's role", async () => {
  const fixture = buttonFixture();
  await handleReactionRoleButton(fixture.interaction as never, fixture.context as never);
  fixture.heldRoles.set("12345", {});
  fixture.interaction.deferred = false;
  await handleReactionRoleButton(fixture.interaction as never, fixture.context as never);

  assert.deepEqual(fixture.roleChanges, [
    ["add", "12345"],
    ["remove", "12345"]
  ]);
  assert.deepEqual(fixture.replies, ["已新增 玩家。", "已移除 玩家。"]);
});

test("ignores unrelated buttons without acknowledging them", async () => {
  const fixture = buttonFixture();
  fixture.interaction.customId = "poll:unrelated";
  assert.equal(
    await handleReactionRoleButton(fixture.interaction as never, fixture.context as never),
    false
  );
  assert.equal(fixture.interaction.deferred, false);
});

test("explains missing permissions, deleted roles, and role hierarchy failures without changing roles", async () => {
  for (const reason of ["permission", "deleted", "hierarchy", "everyone"]) {
    const fixture = buttonFixture();
    if (reason === "permission") fixture.denyManageRoles();
    if (reason === "deleted") fixture.roles.delete("12345");
    if (reason === "hierarchy") fixture.roles.get("12345")!.editable = false;
    if (reason === "everyone") fixture.roles.get("12345")!.id = "guild-1";

    await handleInteractionCreate(fixture.interaction as never, fixture.context as never);
    assert.deepEqual(fixture.roleChanges, []);
    assert.match(fixture.replies[0]!, /管理身分組|無法指派/);
  }
});

test("rejects disabled, deleted, and foreign-guild panels", async () => {
  for (const state of ["disabled", "deleted", "foreign"]) {
    const fixture = buttonFixture();
    if (state === "disabled") fixture.savedPanel.enabled = false;
    if (state === "deleted") fixture.savedPanel.deletedAt = new Date();
    if (state === "foreign") fixture.savedPanel.guildId = "other-guild";

    await handleInteractionCreate(fixture.interaction as never, fixture.context as never);
    assert.deepEqual(fixture.roleChanges, []);
    assert.deepEqual(fixture.replies, ["此身分組面板目前無法使用。"]);
  }
});

test("single-select only removes held panel roles and stops if removal fails", async () => {
  for (const removalFails of [false, true]) {
    const fixture = buttonFixture();
    fixture.savedPanel.mode = "SINGLE_SELECT";
    fixture.savedPanel.options.push({
      ...fixture.savedPanel.options[0]!,
      id: "option-2",
      roleId: "other-role"
    });
    fixture.heldRoles.set("other-role", {});
    fixture.heldRoles.set("unrelated-role", {});
    if (removalFails) {
      fixture.member.roles.remove = async () => {
        throw new Error("Discord API unavailable");
      };
    }

    await handleInteractionCreate(fixture.interaction as never, fixture.context as never);
    assert.deepEqual(
      fixture.roleChanges,
      removalFails
        ? []
        : [
            ["remove", ["other-role"]],
            ["add", "12345"]
          ]
    );
    assert.match(fixture.replies[0]!, removalFails ? /發生錯誤/ : /已新增/);
    assert.equal(fixture.errors.length, removalFails ? 1 : 0);
  }
});

test("does not remove an existing single-select role when the target or previous role is uneditable", async () => {
  for (const roleId of ["12345", "other-role"]) {
    const fixture = buttonFixture();
    fixture.savedPanel.mode = "SINGLE_SELECT";
    fixture.savedPanel.options.push({
      ...fixture.savedPanel.options[0]!,
      id: "option-2",
      roleId: "other-role"
    });
    fixture.heldRoles.set("other-role", {});
    fixture.roles.get(roleId)!.editable = false;
    await handleInteractionCreate(fixture.interaction as never, fixture.context as never);
    assert.deepEqual(fixture.roleChanges, []);
    assert.match(fixture.replies[0]!, /無法/);
  }
});

test("replies to role API and database failures through the shared interaction error handler", async () => {
  for (const source of ["discord", "database"]) {
    const fixture = buttonFixture();
    if (source === "discord") {
      fixture.member.roles.add = async () => {
        throw new Error("Discord API unavailable");
      };
    } else {
      fixture.context.prisma.reactionRoleOption.findUnique = async () => {
        throw new Error("Database unavailable");
      };
    }
    await handleInteractionCreate(fixture.interaction as never, fixture.context as never);
    assert.deepEqual(fixture.replies, ["執行指令時發生錯誤，請稍後再試。"]);
    assert.equal(fixture.errors.length, 1);
  }
});
