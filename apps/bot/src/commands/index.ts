import { pingCommand } from "./utility/ping";
import { serverInfoCommand } from "./utility/serverinfo";
import { userInfoCommand } from "./utility/userinfo";
import { moderationCommands } from "./moderation/actions";
import { levelingCommands } from "./leveling/xp";
import { reactionRoleCommands } from "./reaction-roles/reaction-role";
import { giveawayCommands } from "./giveaways/giveaway";
import { pollCommands } from "./polls/poll";
import { socialAlertCommands } from "./social-alerts/social-alert";
import { economyCommands } from "./economy/economy";
import { shopCommands } from "./economy/shop";
import { economyAdminCommands } from "./economy/admin";
import { ticketCommands } from "./tickets/ticket";
import { inviteTrackingCommands } from "./invite-tracking/invites";
import { reminderCommands } from "./reminders/reminder";
import type { BotCommand } from "./types";

export const commands = [
  pingCommand,
  serverInfoCommand,
  userInfoCommand,
  ...levelingCommands,
  ...economyCommands,
  ...shopCommands,
  ...economyAdminCommands,
  ...moderationCommands,
  ...reactionRoleCommands,
  ...giveawayCommands,
  ...pollCommands,
  ...socialAlertCommands,
  ...ticketCommands,
  ...inviteTrackingCommands,
  ...reminderCommands
] satisfies BotCommand[];

export const commandMap = new Map(commands.map((command) => [command.data.name, command]));
