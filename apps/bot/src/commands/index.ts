import { pingCommand } from "./utility/ping";
import { serverInfoCommand } from "./utility/serverinfo";
import { userInfoCommand } from "./utility/userinfo";
import { moderationCommands } from "./moderation/actions";
import { levelingCommands } from "./leveling/xp";
import { reactionRoleCommands } from "./reaction-roles/reaction-role";
import { giveawayCommands } from "./giveaways/giveaway";
import { pollCommands } from "./polls/poll";
import { socialAlertCommands } from "./social-alerts/social-alert";
import type { BotCommand } from "./types";

export const commands = [
  pingCommand,
  serverInfoCommand,
  userInfoCommand,
  ...levelingCommands,
  ...moderationCommands,
  ...reactionRoleCommands,
  ...giveawayCommands,
  ...pollCommands,
  ...socialAlertCommands
] satisfies BotCommand[];

export const commandMap = new Map(commands.map((command) => [command.data.name, command]));
