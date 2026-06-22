import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Client,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder
} from "discord.js";
import type Redis from "ioredis";

import type { DatabaseClient } from "@guildforge/database";

import type { Logger } from "../lib/logger";
import type { MusicService } from "../lib/music/music";

export type SlashCommandData =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder;

export interface CommandContext {
  prisma: DatabaseClient;
  redis: Redis | null;
  logger: Logger;
  client: Client;
  music: MusicService | null;
}

export interface BotCommand {
  data: SlashCommandData;
  execute(interaction: ChatInputCommandInteraction, context: CommandContext): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction, context: CommandContext): Promise<void>;
}
