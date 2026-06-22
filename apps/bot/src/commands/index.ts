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
import { achievementCommands } from "./achievements/achievements";
import { birthdayCommands } from "./birthdays/birthday";
import { serverStatsCommands } from "./server-stats/server-stats";
import { temporaryVoiceCommands } from "./temporary-voice/voice";
import { membershipCommands } from "./memberships/membership";
import { web3Commands } from "./web3/wallet";
import { musicCommands } from "./music/music";
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
  ...reminderCommands,
  ...achievementCommands,
  ...birthdayCommands,
  ...serverStatsCommands,
  ...temporaryVoiceCommands,
  ...musicCommands,
  ...membershipCommands,
  ...web3Commands
] satisfies BotCommand[];

export const commandMap = new Map(commands.map((command) => [command.data.name, command]));
