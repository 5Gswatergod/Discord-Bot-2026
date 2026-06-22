import { Events } from "discord.js";

import { prisma } from "@guildforge/database";

import type { CommandContext } from "./commands/types";
import { createBotClient } from "./client";
import { env } from "./env";
import { handleGuildCreate } from "./events/guild-create";
import { handleInteractionCreate } from "./events/interaction-create";
import { handleChannelCreate } from "./events/channel-create";
import { handleChannelDelete } from "./events/channel-delete";
import { handleGuildBanAdd } from "./events/guild-ban-add";
import { handleGuildBanRemove } from "./events/guild-ban-remove";
import { handleGuildMemberAdd } from "./events/guild-member-add";
import { handleGuildMemberRemove } from "./events/guild-member-remove";
import { checkExpiredGiveaways } from "./lib/giveaways/giveaways";
import { handleMessageDelete } from "./events/message-delete";
import { handleMessageCreate } from "./events/message-create";
import { handleMessageUpdate } from "./events/message-update";
import { handleReady } from "./events/ready";
import { handleRoleCreate } from "./events/role-create";
import { handleRoleDelete } from "./events/role-delete";
import { handleVoiceStateUpdate } from "./events/voice-state-update";
import { handleReactionRoleReaction } from "./lib/reaction-roles/reaction-roles";
import { logger } from "./lib/logger";
import { createRedisClient } from "./lib/redis";
import { checkSocialAlerts } from "./lib/social-alerts/social-alerts";
import { syncTicketPanels } from "./lib/tickets/tickets";
import { syncEmbedMessages } from "./lib/embed-messages/embed-messages";
import { checkDueReminders } from "./lib/reminders/reminders";
import { refreshGuildInviteSnapshot } from "./lib/invite-tracking/invite-tracking";

async function main() {
  const client = createBotClient();
  let redis: CommandContext["redis"] = null;

  await prisma.$connect();

  try {
    redis = await createRedisClient();
    logger.info("Connected to Redis");
  } catch (error) {
    logger.warn("Redis is unavailable; cooldown-backed modules will be disabled until it returns", {
      error
    });
  }

  const context: CommandContext = {
    prisma,
    redis,
    logger,
    client
  };

  client.once(Events.ClientReady, (readyClient) => {
    void handleReady(readyClient, context);
  });

  client.on(Events.GuildCreate, (guild) => {
    void handleGuildCreate(guild, context);
  });

  client.on(Events.InteractionCreate, (interaction) => {
    void handleInteractionCreate(interaction, context);
  });

  client.on(Events.MessageReactionAdd, (reaction, user) => {
    void handleReactionRoleReaction(reaction, user, context, "add");
  });

  client.on(Events.MessageReactionRemove, (reaction, user) => {
    void handleReactionRoleReaction(reaction, user, context, "remove");
  });

  client.on(Events.MessageDelete, (message) => {
    void handleMessageDelete(message, context);
  });

  client.on(Events.MessageCreate, (message) => {
    void handleMessageCreate(message, context);
  });

  client.on(Events.MessageUpdate, (oldMessage, newMessage) => {
    void handleMessageUpdate(oldMessage, newMessage, context);
  });

  client.on(Events.GuildMemberAdd, (member) => {
    void handleGuildMemberAdd(member, context);
  });

  client.on(Events.GuildMemberRemove, (member) => {
    void handleGuildMemberRemove(member, context);
  });

  client.on(Events.GuildBanAdd, (ban) => {
    void handleGuildBanAdd(ban, context);
  });

  client.on(Events.GuildBanRemove, (ban) => {
    void handleGuildBanRemove(ban, context);
  });

  client.on(Events.GuildRoleCreate, (role) => {
    void handleRoleCreate(role, context);
  });

  client.on(Events.GuildRoleDelete, (role) => {
    void handleRoleDelete(role, context);
  });

  client.on(Events.ChannelCreate, (channel) => {
    if (channel.isDMBased()) {
      return;
    }

    void handleChannelCreate(channel, context);
  });

  client.on(Events.ChannelDelete, (channel) => {
    if (channel.isDMBased()) {
      return;
    }

    void handleChannelDelete(channel, context);
  });

  client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    void handleVoiceStateUpdate(oldState, newState, context);
  });

  client.on(Events.InviteCreate, (invite) => {
    const guild = invite.guild ? context.client.guilds.cache.get(invite.guild.id) : null;

    if (guild) {
      void refreshGuildInviteSnapshot(guild, context);
    }
  });

  client.on(Events.InviteDelete, (invite) => {
    const guild = invite.guild ? context.client.guilds.cache.get(invite.guild.id) : null;

    if (guild) {
      void refreshGuildInviteSnapshot(guild, context);
    }
  });

  const giveawayInterval = setInterval(() => {
    void checkExpiredGiveaways(context);
  }, 60_000);
  const socialAlertInterval = setInterval(() => {
    void checkSocialAlerts(context);
  }, 60_000);
  const ticketPanelInterval = setInterval(() => {
    void syncTicketPanels(context);
  }, 60_000);
  const embedMessageInterval = setInterval(() => {
    void syncEmbedMessages(context);
  }, 30_000);
  const reminderInterval = setInterval(() => {
    void checkDueReminders(context);
  }, 30_000);

  void syncTicketPanels(context);
  void syncEmbedMessages(context);
  void checkDueReminders(context);

  const shutdown = async (signal: string) => {
    logger.info("Shutting down bot", {
      signal
    });

    client.destroy();
    clearInterval(giveawayInterval);
    clearInterval(socialAlertInterval);
    clearInterval(ticketPanelInterval);
    clearInterval(embedMessageInterval);
    clearInterval(reminderInterval);
    redis?.disconnect();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  await client.login(env.DISCORD_BOT_TOKEN);
}

main().catch(async (error) => {
  logger.error("Bot crashed during startup", error);
  await prisma.$disconnect();
  process.exit(1);
});
