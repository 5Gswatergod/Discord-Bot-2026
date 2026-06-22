import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ClientUser,
  type Guild,
  type GuildMember,
  type Message,
  type StringSelectMenuInteraction
} from "discord.js";
import {
  LavalinkManager,
  type LavalinkPlayer,
  type Player,
  type QueueStoreManager,
  type RepeatMode,
  type SearchResult,
  type StoredQueue,
  type Track,
  type UnresolvedSearchResult,
  type UnresolvedTrack
} from "lavalink-client";

import { musicSettingsSchema, type MusicSettings } from "@guildforge/shared";

import type { CommandContext } from "../../commands/types";
import { env } from "../../env";
import { isGuildModuleEnabled } from "../modules";
import {
  MusicUserError,
  classifyMusicQuery,
  computeQueueAllowance,
  computeSkipThreshold,
  getRequesterId,
  serializeMusicStatus
} from "./music-policy";

export { MusicUserError } from "./music-policy";

const nodeStateKey = "hydrava:music:node";
const sessionKey = "hydrava:music:lavalink-session";
const statusKey = (guildId: string) => `hydrava:music:status:${guildId}`;
const playerStateKey = (guildId: string) => `hydrava:music:player:${guildId}`;
const queueKey = (guildId: string) => `hydrava:music:queue:${guildId}`;
const redisStatusTtlSeconds = 45;
const redisRecoveryTtlSeconds = 120;
const pendingSearchTtlMs = 60_000;

type MusicRequester = {
  id: string;
  username: string;
};

type MusicTrack = Track | UnresolvedTrack;

type PendingSearch = {
  guildId: string;
  voiceChannelId: string;
  textChannelId: string;
  requester: MusicRequester;
  tracks: MusicTrack[];
  expiresAt: number;
};

type MusicSession = {
  controlMessageId: string | null;
  skipVotes: Set<string>;
  emptySince: number | null;
  idleSince: number | null;
};

type StoredPlayerState = {
  guildId: string;
  voiceChannelId: string;
  textChannelId: string;
  controlMessageId: string | null;
  skipVotes?: string[];
};

class RedisMusicQueueStore implements QueueStoreManager {
  private readonly fallback = new Map<string, string>();

  constructor(private readonly context: CommandContext) {}

  async get(guildId: string) {
    const fallbackValue = this.fallback.get(guildId);

    if (!this.context.redis) {
      return fallbackValue;
    }

    try {
      return (await this.context.redis.get(queueKey(guildId))) ?? fallbackValue;
    } catch {
      return fallbackValue;
    }
  }

  async set(guildId: string, value: string | StoredQueue) {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    this.fallback.set(guildId, serialized);

    if (!this.context.redis) {
      return true;
    }

    await this.context.redis
      .set(queueKey(guildId), serialized, "EX", redisRecoveryTtlSeconds)
      .catch(() => null);
    return true;
  }

  async delete(guildId: string) {
    this.fallback.delete(guildId);
    await this.context.redis?.del(queueKey(guildId)).catch(() => null);
    return true;
  }

  parse(value: string | StoredQueue) {
    return typeof value === "string" ? (JSON.parse(value) as Partial<StoredQueue>) : value;
  }

  stringify(value: string | StoredQueue) {
    return typeof value === "string" ? value : JSON.stringify(value);
  }
}

export class MusicService {
  readonly manager: LavalinkManager | null;
  readonly spotifyConfigured = Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET);

  private readonly sessions = new Map<string, MusicSession>();
  private readonly pendingSearches = new Map<string, PendingSearch>();
  private nodeConnected = false;
  private nodeDisconnectedAt: number | null = null;

  private constructor(
    private readonly context: CommandContext,
    previousSessionId: string | null
  ) {
    if (!env.LAVALINK_PASSWORD) {
      this.manager = null;
      return;
    }

    this.manager = new LavalinkManager({
      nodes: [
        {
          id: "hydrava-main",
          host: env.LAVALINK_HOST,
          port: env.LAVALINK_PORT,
          authorization: env.LAVALINK_PASSWORD,
          secure: false,
          retryAmount: 6,
          retryDelay: 10_000,
          retryTimespan: 60_000,
          sessionId: previousSessionId ?? undefined
        }
      ],
      sendToShard: (guildId, payload) => {
        this.context.client.guilds.cache.get(guildId)?.shard.send(payload);
      },
      autoSkip: true,
      autoMove: true,
      autoSkipOnResolveError: true,
      emitNewSongsOnly: false,
      linksAllowed: true,
      linksWhitelist: [
        /^https:\/\/(?:www\.)?youtube\.com\//i,
        /^https:\/\/m\.youtube\.com\//i,
        /^https:\/\/music\.youtube\.com\//i,
        /^https:\/\/youtu\.be\//i,
        /^https:\/\/open\.spotify\.com\//i
      ],
      playerOptions: {
        defaultSearchPlatform: "ytsearch",
        requesterTransformer: (requester) => {
          const value = requester as Partial<MusicRequester> | null;
          return {
            id: typeof value?.id === "string" ? value.id : "unknown",
            username: typeof value?.username === "string" ? value.username : "Unknown"
          } satisfies MusicRequester;
        },
        onDisconnect: {
          autoReconnect: true,
          autoReconnectOnlyWithTracks: false,
          destroyPlayer: false
        },
        useUnresolvedData: false,
        enforceSponsorBlockRequestForEventEnablement: false
      },
      queueOptions: {
        maxPreviousTracks: 10,
        queueStore: new RedisMusicQueueStore(this.context)
      }
    });

    this.registerManagerEvents();
  }

  static async create(context: CommandContext) {
    const previousSessionId = await context.redis?.get(sessionKey).catch(() => null);
    return new MusicService(context, previousSessionId ?? null);
  }

  async initialize(user: ClientUser) {
    if (!this.manager) {
      this.context.logger.warn("Music player is disabled because LAVALINK_PASSWORD is not set");
      await this.persistNodeState();
      return;
    }

    await this.manager.init({
      id: user.id,
      username: user.username
    });
  }

  async handleRaw(payload: unknown) {
    await this.manager?.sendRawData(payload as never);
  }

  async prepareShutdown() {
    await Promise.all(
      [...(this.manager?.players.values() ?? [])].map((player) => this.persistPlayer(player))
    );
    await this.refreshSessionState();
  }

  isUsable() {
    return Boolean(this.manager?.useable);
  }

  async getSettings(guildId: string): Promise<MusicSettings> {
    const config = await this.context.prisma.moduleConfig.findUnique({
      where: {
        guildId_module: {
          guildId,
          module: "MUSIC"
        }
      }
    });

    return musicSettingsSchema.parse(config?.settings ?? {});
  }

  async play(interaction: ChatInputCommandInteraction, query: string) {
    const access = await this.requireAccess(interaction, {
      requirePlayer: false,
      enforceRequestChannel: true
    });
    await interaction.deferReply();

    const classified = classifyMusicQuery(query);

    if (classified.type === "spotify" && !this.spotifyConfigured) {
      throw new MusicUserError(
        "Hydrava 尚未設定 Spotify Client ID／Secret；YouTube 搜尋與連結仍可使用。"
      );
    }

    const player = this.getOrCreatePlayer(
      access.guild,
      access.member,
      interaction.channelId,
      access.settings
    );
    const result = await player.search(
      classified.type === "search"
        ? {
            query: classified.query,
            source: "ytsearch"
          }
        : {
            query: classified.query
          },
      {
        id: interaction.user.id,
        username: interaction.user.username
      } satisfies MusicRequester
    );
    const tracks = this.filterTracks(result, access.settings);

    if (tracks.length === 0) {
      throw new MusicUserError("找不到可播放的歌曲。");
    }

    if (classified.type === "search") {
      const nonce = crypto.randomUUID();
      const choices = tracks.slice(0, 5);
      this.pendingSearches.set(nonce, {
        guildId: access.guild.id,
        voiceChannelId: access.member.voice.channelId!,
        textChannelId: interaction.channelId,
        requester: {
          id: interaction.user.id,
          username: interaction.user.username
        },
        tracks: choices,
        expiresAt: Date.now() + pendingSearchTtlMs
      });

      const select = new StringSelectMenuBuilder()
        .setCustomId(`music:search:${nonce}`)
        .setPlaceholder("選擇要加入佇列的歌曲")
        .addOptions(
          choices.map((track, index) => ({
            label: track.info.title.slice(0, 100),
            description:
              `${track.info.author} · ${formatDuration(track.info.duration, track.info.isStream)}`.slice(
                0,
                100
              ),
            value: String(index)
          }))
        );

      await interaction.editReply({
        content: "找到以下結果，請在 60 秒內選擇一首：",
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)]
      });
      return;
    }

    const queued = await this.enqueueTracks(player, tracks, access.settings, interaction.user.id);
    await interaction.editReply({
      content:
        result.playlist && queued.length > 1
          ? `已從「${result.playlist.name}」加入 ${queued.length} 首歌曲。`
          : `已加入佇列：**${queued[0]?.info.title ?? "歌曲"}**`
    });
  }

  async handleSearchSelection(interaction: StringSelectMenuInteraction) {
    const nonce = interaction.customId.slice("music:search:".length);
    const pending = this.pendingSearches.get(nonce);

    if (!pending || pending.expiresAt <= Date.now()) {
      this.pendingSearches.delete(nonce);
      await interaction.reply({
        content: "這個搜尋結果已過期，請重新使用 `/play`。",
        ephemeral: true
      });
      return true;
    }

    if (interaction.user.id !== pending.requester.id) {
      await interaction.reply({
        content: "只有發起搜尋的人可以選擇歌曲。",
        ephemeral: true
      });
      return true;
    }

    const member = await interaction.guild?.members.fetch(interaction.user.id);

    if (!member || member.voice.channelId !== pending.voiceChannelId) {
      throw new MusicUserError("你必須留在原本的語音頻道才能加入歌曲。");
    }

    if (!(await isGuildModuleEnabled(this.context.prisma, pending.guildId, "MUSIC"))) {
      throw new MusicUserError("此伺服器尚未啟用音樂播放器。");
    }

    if (!this.manager?.useable) {
      throw new MusicUserError("音訊節點目前無法連線，請稍後再試。");
    }

    const player = this.manager?.getPlayer(pending.guildId);
    const track = pending.tracks[Number(interaction.values[0])];

    if (!player || player.voiceChannelId !== pending.voiceChannelId || !track) {
      throw new MusicUserError("播放器或搜尋結果已失效，請重新使用 `/play`。");
    }

    const settings = await this.getSettings(pending.guildId);
    if (
      settings.requestChannelIds.length > 0 &&
      !settings.requestChannelIds.includes(pending.textChannelId)
    ) {
      throw new MusicUserError(
        `請在 ${settings.requestChannelIds.map((id) => `<#${id}>`).join("、")} 使用音樂指令。`
      );
    }

    await this.enqueueTracks(player, [track], settings, interaction.user.id);
    this.pendingSearches.delete(nonce);
    await interaction.update({
      content: `已加入佇列：**${track.info.title}**`,
      components: []
    });
    return true;
  }

  async showQueue(interaction: ChatInputCommandInteraction, page = 1) {
    const access = await this.requireAccess(interaction, {
      requirePlayer: true,
      requireSameVoice: false
    });
    const player = access.player!;
    await interaction.reply({
      embeds: [this.buildQueueEmbed(player, page)],
      ephemeral: true
    });
  }

  async showNowPlaying(interaction: ChatInputCommandInteraction) {
    const access = await this.requireAccess(interaction, {
      requirePlayer: true,
      requireSameVoice: false
    });
    await interaction.reply({
      embeds: [this.buildNowPlayingEmbed(access.player!)],
      components: this.buildControls(access.player!),
      ephemeral: true
    });
  }

  async pause(interaction: ChatInputCommandInteraction | ButtonInteraction) {
    const access = await this.requireAccess(interaction, {
      requirePlayer: true,
      requireSameVoice: true
    });
    await access.player!.pause();
    await this.respond(interaction, "已暫停播放。");
    await this.refreshControlPanel(access.player!);
  }

  async resume(interaction: ChatInputCommandInteraction | ButtonInteraction) {
    const access = await this.requireAccess(interaction, {
      requirePlayer: true,
      requireSameVoice: true
    });
    await access.player!.resume();
    await this.respond(interaction, "已繼續播放。");
    await this.refreshControlPanel(access.player!);
  }

  async skip(interaction: ChatInputCommandInteraction | ButtonInteraction) {
    const access = await this.requireAccess(interaction, {
      requirePlayer: true,
      requireSameVoice: true
    });
    const player = access.player!;
    const session = this.getSession(player.guildId);
    const requesterId = getRequesterId(player.queue.current);

    if (access.isDj || requesterId === interaction.user.id) {
      await player.skip();
      session.skipVotes.clear();
      await this.respond(interaction, "已跳過目前歌曲。");
      return;
    }

    if (session.skipVotes.has(interaction.user.id)) {
      await this.respond(interaction, "你已經投過跳歌票了。");
      return;
    }

    session.skipVotes.add(interaction.user.id);
    const voiceChannel = access.member.voice.channel;
    const listeners = voiceChannel?.members.filter((member) => !member.user.bot);
    const listenerIds = new Set(listeners?.keys() ?? []);
    for (const voterId of session.skipVotes) {
      if (!listenerIds.has(voterId)) {
        session.skipVotes.delete(voterId);
      }
    }
    const listenerCount = listeners?.size ?? 1;
    const requiredVotes = computeSkipThreshold(listenerCount);

    if (session.skipVotes.size >= requiredVotes) {
      await player.skip();
      session.skipVotes.clear();
      await this.respond(interaction, "跳歌投票通過，已播放下一首。");
      return;
    }

    await this.respond(
      interaction,
      `已投票跳歌，目前 ${session.skipVotes.size}/${requiredVotes} 票。`
    );
    await this.persistPlayer(player);
  }

  async remove(interaction: ChatInputCommandInteraction, position: number) {
    const access = await this.requireAccess(interaction, {
      requirePlayer: true,
      requireSameVoice: true
    });
    const track = access.player!.queue.tracks[position - 1];

    if (!track) {
      throw new MusicUserError("找不到這個佇列位置。");
    }

    if (!access.isDj && getRequesterId(track) !== interaction.user.id) {
      throw new MusicUserError("你只能移除自己加入的歌曲。");
    }

    await access.player!.queue.remove(position - 1);
    await interaction.reply({
      content: `已移除：**${track.info.title}**`,
      ephemeral: true
    });
    await this.persistPlayer(access.player!);
    await this.refreshControlPanel(access.player!);
  }

  async shuffle(interaction: ChatInputCommandInteraction | ButtonInteraction) {
    const access = await this.requireDj(interaction);
    await access.player.queue.shuffle();
    await this.respond(interaction, "已隨機排列佇列。");
    await this.refreshControlPanel(access.player);
  }

  async setLoop(interaction: ChatInputCommandInteraction, mode: RepeatMode) {
    const access = await this.requireDj(interaction);
    await access.player.setRepeatMode(mode);
    await interaction.reply({
      content: `循環模式已設為：${loopModeLabel(mode)}。`,
      ephemeral: true
    });
    await this.refreshControlPanel(access.player);
  }

  async cycleLoop(interaction: ButtonInteraction) {
    const access = await this.requireDj(interaction);
    const nextMode: RepeatMode =
      access.player.repeatMode === "off"
        ? "track"
        : access.player.repeatMode === "track"
          ? "queue"
          : "off";
    await access.player.setRepeatMode(nextMode);
    await this.respond(interaction, `循環模式已設為：${loopModeLabel(nextMode)}。`);
    await this.refreshControlPanel(access.player);
  }

  async setVolume(interaction: ChatInputCommandInteraction, volume: number) {
    const access = await this.requireDj(interaction);

    if (volume > access.settings.maxVolume) {
      throw new MusicUserError(`此伺服器允許的最大音量是 ${access.settings.maxVolume}%。`);
    }

    await access.player.setVolume(volume, true);
    await interaction.reply({
      content: `音量已調整為 ${volume}%。`,
      ephemeral: true
    });
    await this.refreshControlPanel(access.player);
  }

  async stop(interaction: ChatInputCommandInteraction | ButtonInteraction) {
    const access = await this.requireDj(interaction);
    await this.destroyPlayer(access.player, "Stopped by a DJ");
    await this.respond(interaction, "已清空佇列並離開語音頻道。");
  }

  async handleButton(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith("music:")) {
      return false;
    }

    switch (interaction.customId) {
      case "music:toggle": {
        const player = interaction.guildId ? this.manager?.getPlayer(interaction.guildId) : null;
        if (player?.paused) {
          await this.resume(interaction);
        } else {
          await this.pause(interaction);
        }
        return true;
      }
      case "music:skip":
        await this.skip(interaction);
        return true;
      case "music:queue": {
        const access = await this.requireAccess(interaction, {
          requirePlayer: true,
          requireSameVoice: false
        });
        await interaction.reply({
          embeds: [this.buildQueueEmbed(access.player!, 1)],
          ephemeral: true
        });
        return true;
      }
      case "music:loop":
        await this.cycleLoop(interaction);
        return true;
      case "music:shuffle":
        await this.shuffle(interaction);
        return true;
      case "music:stop":
        await this.stop(interaction);
        return true;
      default:
        return false;
    }
  }

  async reconcile() {
    this.cleanupPendingSearches();
    await this.persistNodeState();
    await this.refreshSessionState();

    if (!this.manager) {
      return;
    }

    if (
      !this.manager.useable &&
      this.nodeDisconnectedAt &&
      Date.now() - this.nodeDisconnectedAt >= 60_000
    ) {
      for (const player of [...this.manager.players.values()]) {
        await this.notifyPlayerChannel(
          player,
          "音訊節點已中斷超過 60 秒，Hydrava 已安全停止播放器。"
        );
        await this.destroyPlayer(player, "Lavalink unavailable for 60 seconds");
      }
      return;
    }

    for (const player of this.manager.players.values()) {
      const enabled = await isGuildModuleEnabled(this.context.prisma, player.guildId, "MUSIC");

      if (!enabled) {
        await this.destroyPlayer(player, "Music module disabled");
        continue;
      }

      const settings = await this.getSettings(player.guildId);
      const session = this.getSession(player.guildId);
      if (
        settings.announcementChannelId &&
        settings.announcementChannelId !== player.textChannelId
      ) {
        player.textChannelId = settings.announcementChannelId;
        session.controlMessageId = null;
      }
      const guild = this.context.client.guilds.cache.get(player.guildId);
      const channel = player.voiceChannelId
        ? await guild?.channels.fetch(player.voiceChannelId).catch(() => null)
        : null;
      const listenerCount =
        channel?.type === ChannelType.GuildVoice
          ? channel.members.filter((member) => !member.user.bot).size
          : 0;
      const now = Date.now();

      if (listenerCount === 0) {
        session.emptySince ??= now;
        if (now - session.emptySince >= settings.emptyChannelTimeoutSeconds * 1_000) {
          await this.destroyPlayer(player, "Voice channel remained empty");
          continue;
        }
      } else {
        session.emptySince = null;
      }

      if (!player.queue.current && player.queue.tracks.length === 0) {
        session.idleSince ??= now;
        if (now - session.idleSince >= settings.idleTimeoutSeconds * 1_000) {
          await this.destroyPlayer(player, "Queue remained idle");
          continue;
        }
      } else {
        session.idleSince = null;
      }

      await player.queue.utils.save().catch(() => null);
      await this.persistPlayer(player);
    }
  }

  private registerManagerEvents() {
    if (!this.manager) {
      return;
    }

    this.manager.nodeManager.on("connect", (node) => {
      this.nodeConnected = true;
      this.nodeDisconnectedAt = null;
      void node.updateSession(true, 60_000);
      void this.refreshSessionState();
      void this.persistNodeState();
      this.context.logger.info("Connected to Lavalink", {
        nodeId: node.id
      });
    });
    this.manager.nodeManager.on("disconnect", (node, reason) => {
      const shouldNotify = this.nodeDisconnectedAt === null;
      this.nodeConnected = false;
      this.nodeDisconnectedAt ??= Date.now();
      void this.persistNodeState();
      if (shouldNotify) {
        for (const player of this.manager?.players.values() ?? []) {
          void this.notifyPlayerChannel(
            player,
            "音訊節點暫時中斷，Hydrava 正在嘗試於 60 秒內恢復播放。"
          );
        }
      }
      this.context.logger.warn("Lavalink disconnected", {
        nodeId: node.id,
        reason
      });
    });
    this.manager.nodeManager.on("error", (node, error) => {
      this.context.logger.error("Lavalink node error", {
        nodeId: node.id,
        error
      });
    });
    this.manager.nodeManager.on("resumed", (node, _payload, players) => {
      if (!Array.isArray(players)) {
        return;
      }
      void this.restorePlayers(node.id, players);
    });
    this.manager.on("trackStart", (player) => {
      const session = this.getSession(player.guildId);
      session.skipVotes.clear();
      session.idleSince = null;
      void this.refreshControlPanel(player);
      void this.persistPlayer(player);
    });
    this.manager.on("queueEnd", (player) => {
      this.getSession(player.guildId).idleSince = Date.now();
      void this.refreshControlPanel(player);
      void this.persistPlayer(player);
    });
    this.manager.on("playerClientUpdate", (_oldPlayer, player) => {
      void this.persistPlayer(player);
    });
    this.manager.on("trackError", (player, track, payload) => {
      this.context.logger.warn("Music track failed", {
        guildId: player.guildId,
        title: track?.info.title,
        payload
      });
      void this.notifyPlayerChannel(
        player,
        `無法播放「${track?.info.title ?? "目前歌曲"}」，Hydrava 將嘗試播放下一首。`
      );
    });
    this.manager.on("playerDestroy", (player) => {
      this.sessions.delete(player.guildId);
      void this.clearRedisPlayer(player.guildId);
    });
  }

  private async restorePlayers(nodeId: string, lavalinkPlayers: LavalinkPlayer[]) {
    if (!this.manager || !this.context.redis) {
      return;
    }

    for (const lavalinkPlayer of lavalinkPlayers) {
      try {
        const raw = await this.context.redis
          .get(playerStateKey(lavalinkPlayer.guildId))
          .catch(() => null);

        if (!raw || !lavalinkPlayer.state.connected) {
          continue;
        }

        const stored = JSON.parse(raw) as StoredPlayerState;
        const enabled = await isGuildModuleEnabled(
          this.context.prisma,
          lavalinkPlayer.guildId,
          "MUSIC"
        );

        if (!enabled) {
          await this.clearRedisPlayer(lavalinkPlayer.guildId);
          continue;
        }

        const player = this.manager.createPlayer({
          guildId: stored.guildId,
          voiceChannelId: stored.voiceChannelId,
          textChannelId: stored.textChannelId,
          node: nodeId,
          volume: lavalinkPlayer.volume,
          selfDeaf: true
        });
        await player.connect();
        await player.queue.utils.sync(true, false);
        player.paused = lavalinkPlayer.paused;
        player.lastPosition = lavalinkPlayer.state.position;
        player.filterManager.data = lavalinkPlayer.filters;

        if (lavalinkPlayer.track) {
          player.queue.current = this.manager.utils.buildTrack(
            lavalinkPlayer.track,
            lavalinkPlayer.track.userData ?? { id: "unknown", username: "Unknown" }
          );
        }

        this.sessions.set(player.guildId, {
          controlMessageId: stored.controlMessageId,
          skipVotes: new Set(stored.skipVotes ?? []),
          emptySince: null,
          idleSince: null
        });
        await this.refreshControlPanel(player);
      } catch (error) {
        this.context.logger.warn("Failed to restore Lavalink player", {
          guildId: lavalinkPlayer.guildId,
          error
        });
        await this.clearRedisPlayer(lavalinkPlayer.guildId);
      }
    }
  }

  private async requireAccess(
    interaction: ChatInputCommandInteraction | ButtonInteraction,
    options: {
      requirePlayer: boolean;
      requireSameVoice?: boolean;
      enforceRequestChannel?: boolean;
    }
  ) {
    if (!interaction.guildId || !interaction.guild) {
      throw new MusicUserError("此功能只能在伺服器內使用。");
    }

    if (!(await isGuildModuleEnabled(this.context.prisma, interaction.guildId, "MUSIC"))) {
      throw new MusicUserError("此伺服器尚未啟用音樂播放器。");
    }

    if (!this.manager) {
      throw new MusicUserError("Hydrava 尚未設定 Lavalink 音訊服務。");
    }

    if (!this.manager.useable) {
      throw new MusicUserError("音訊節點目前無法連線，請稍後再試。");
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const settings = await this.getSettings(interaction.guildId);
    const isDj = this.isDj(member, settings);

    if (
      options.enforceRequestChannel &&
      settings.requestChannelIds.length > 0 &&
      !settings.requestChannelIds.includes(interaction.channelId)
    ) {
      throw new MusicUserError(
        `請在 ${settings.requestChannelIds.map((id) => `<#${id}>`).join("、")} 使用音樂指令。`
      );
    }

    if (!member.voice.channelId || member.voice.channel?.type !== ChannelType.GuildVoice) {
      throw new MusicUserError("請先加入一般語音頻道；目前不支援舞台頻道。");
    }

    const player = this.manager.getPlayer(interaction.guildId);

    if (options.requirePlayer && !player) {
      throw new MusicUserError("此伺服器目前沒有播放器。");
    }

    if (
      (options.requireSameVoice || player) &&
      player?.voiceChannelId &&
      player.voiceChannelId !== member.voice.channelId
    ) {
      throw new MusicUserError("你必須和 Hydrava 在同一個語音頻道。");
    }

    return {
      guild: interaction.guild,
      member,
      settings,
      player,
      isDj
    };
  }

  private async requireDj(interaction: ChatInputCommandInteraction | ButtonInteraction) {
    const access = await this.requireAccess(interaction, {
      requirePlayer: true,
      requireSameVoice: true
    });

    if (!access.isDj) {
      throw new MusicUserError("此操作僅限 DJ 身分組或具管理伺服器權限的成員。");
    }

    return {
      ...access,
      player: access.player!
    };
  }

  private isDj(member: GuildMember, settings: MusicSettings) {
    return (
      member.permissions.has(PermissionFlagsBits.ManageGuild) ||
      Boolean(settings.djRoleId && member.roles.cache.has(settings.djRoleId))
    );
  }

  private getOrCreatePlayer(
    guild: Guild,
    member: GuildMember,
    textChannelId: string,
    settings: MusicSettings
  ) {
    if (!this.manager || !member.voice.channelId) {
      throw new MusicUserError("播放器尚未準備完成。");
    }

    const voiceChannel = member.voice.channel;
    const botMember = guild.members.me;
    const voicePermissions = botMember ? voiceChannel?.permissionsFor(botMember) : null;

    if (
      !voiceChannel ||
      !voicePermissions?.has([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak
      ])
    ) {
      throw new MusicUserError("Hydrava 缺少查看頻道、連線或說話權限，請先調整語音頻道權限。");
    }

    const existing = this.manager.getPlayer(guild.id);

    if (existing) {
      if (existing.voiceChannelId !== member.voice.channelId) {
        throw new MusicUserError("Hydrava 已在另一個語音頻道播放音樂。");
      }
      return existing;
    }

    return this.manager.createPlayer({
      guildId: guild.id,
      voiceChannelId: member.voice.channelId,
      textChannelId: settings.announcementChannelId ?? textChannelId,
      volume: settings.defaultVolume,
      selfDeaf: true,
      selfMute: false
    });
  }

  private filterTracks(
    result: SearchResult | UnresolvedSearchResult,
    settings: MusicSettings
  ): MusicTrack[] {
    const tracks = result.tracks.filter(
      (track) => settings.allowLiveStreams || !track.info.isStream
    );

    return result.playlist ? tracks.slice(0, settings.playlistTrackLimit) : tracks;
  }

  private async enqueueTracks(
    player: Player,
    tracks: MusicTrack[],
    settings: MusicSettings,
    requesterId: string
  ) {
    const currentSize = player.queue.tracks.length + (player.queue.current ? 1 : 0);
    const requesterTrackCount = [player.queue.current, ...player.queue.tracks].filter(
      (track) => track && getRequesterId(track) === requesterId
    ).length;
    const allowedCount = computeQueueAllowance({
      requestedTracks: tracks.length,
      currentQueueSize: currentSize,
      requesterTrackCount,
      maxQueueSize: settings.maxQueueSize,
      maxTracksPerUser: settings.maxTracksPerUser
    });

    if (allowedCount <= 0) {
      throw new MusicUserError(
        requesterTrackCount >= settings.maxTracksPerUser
          ? `你最多只能同時加入 ${settings.maxTracksPerUser} 首歌曲。`
          : `佇列最多只能包含 ${settings.maxQueueSize} 首歌曲。`
      );
    }

    const queued = tracks.slice(0, allowedCount);
    await player.queue.add(queued);

    if (!player.connected) {
      await player.connect();
    }

    if (!player.playing && !player.paused) {
      await player.play();
    }

    const session = this.getSession(player.guildId);
    session.idleSince = null;
    await this.persistPlayer(player);
    await this.refreshControlPanel(player);
    return queued;
  }

  private getSession(guildId: string) {
    let session = this.sessions.get(guildId);

    if (!session) {
      session = {
        controlMessageId: null,
        skipVotes: new Set(),
        emptySince: null,
        idleSince: null
      };
      this.sessions.set(guildId, session);
    }

    return session;
  }

  private buildNowPlayingEmbed(player: Player) {
    const track = player.queue.current;
    const position = track?.info.isStream ? "直播" : formatDuration(player.position, false);
    const duration = track ? formatDuration(track.info.duration, track.info.isStream) : "沒有歌曲";

    return new EmbedBuilder()
      .setColor(0x22d3ee)
      .setTitle(track ? "正在播放" : "播放器待命中")
      .setDescription(
        track
          ? `**[${track.info.title}](${track.info.uri})**\n${track.info.author}`
          : "目前佇列沒有歌曲。"
      )
      .addFields(
        {
          name: "進度",
          value: `${position} / ${duration}`,
          inline: true
        },
        {
          name: "音量",
          value: `${player.volume}%`,
          inline: true
        },
        {
          name: "循環",
          value: loopModeLabel(player.repeatMode),
          inline: true
        },
        {
          name: "佇列",
          value: `${player.queue.tracks.length} 首`,
          inline: true
        },
        {
          name: "點歌者",
          value: getRequesterId(track) ? `<@${getRequesterId(track)}>` : "未知",
          inline: true
        }
      )
      .setThumbnail(track?.info.artworkUrl ?? null)
      .setFooter({
        text: player.paused ? "已暫停" : "Hydrava Music"
      });
  }

  private buildQueueEmbed(player: Player, requestedPage: number) {
    const perPage = 10;
    const pageCount = Math.max(1, Math.ceil(player.queue.tracks.length / perPage));
    const page = Math.min(Math.max(1, requestedPage), pageCount);
    const start = (page - 1) * perPage;
    const tracks = player.queue.tracks.slice(start, start + perPage);
    const lines = tracks.map((track, index) => {
      const requesterId = getRequesterId(track);
      return `**${start + index + 1}.** [${track.info.title}](${track.info.uri}) · ${formatDuration(
        track.info.duration,
        track.info.isStream
      )}${requesterId ? ` · <@${requesterId}>` : ""}`;
    });

    return new EmbedBuilder()
      .setColor(0x22d3ee)
      .setTitle("音樂佇列")
      .setDescription(lines.length > 0 ? lines.join("\n") : "目前沒有等待中的歌曲。")
      .setFooter({
        text: `第 ${page}/${pageCount} 頁 · 共 ${player.queue.tracks.length} 首`
      });
  }

  private buildControls(player: Player) {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("music:toggle")
          .setLabel(player.paused ? "繼續" : "暫停")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("music:skip")
          .setLabel("跳過")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("music:queue")
          .setLabel("佇列")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("music:loop")
          .setLabel(`循環：${loopModeLabel(player.repeatMode)}`)
          .setStyle(ButtonStyle.Secondary)
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("music:shuffle")
          .setLabel("隨機")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("music:stop")
          .setLabel("停止並離開")
          .setStyle(ButtonStyle.Danger)
      )
    ];
  }

  private async refreshControlPanel(player: Player) {
    if (!player.textChannelId) {
      return;
    }

    const channel = await this.context.client.channels
      .fetch(player.textChannelId)
      .catch(() => null);

    if (!channel?.isTextBased() || !("send" in channel)) {
      return;
    }

    const session = this.getSession(player.guildId);
    const payload = {
      embeds: [this.buildNowPlayingEmbed(player)],
      components: this.buildControls(player)
    };
    let message: Message | null = null;

    if (session.controlMessageId && "messages" in channel) {
      message = await channel.messages.fetch(session.controlMessageId).catch(() => null);
    }

    if (message) {
      await message.edit(payload).catch(() => null);
    } else {
      const sent = await channel.send(payload).catch(() => null);
      session.controlMessageId = sent?.id ?? null;
    }

    await this.persistPlayer(player);
  }

  private async persistPlayer(player: Player) {
    const session = this.getSession(player.guildId);
    const state: StoredPlayerState | null =
      player.voiceChannelId && player.textChannelId
        ? {
            guildId: player.guildId,
            voiceChannelId: player.voiceChannelId,
            textChannelId: player.textChannelId,
            controlMessageId: session.controlMessageId,
            skipVotes: [...session.skipVotes]
          }
        : null;
    const status = serializeMusicStatus(player, {
      nodeConnected: this.nodeConnected,
      spotifyConfigured: this.spotifyConfigured,
      redisAvailable: Boolean(this.context.redis)
    });

    if (!this.context.redis) {
      return;
    }

    const transaction = this.context.redis.multi();
    transaction.set(statusKey(player.guildId), JSON.stringify(status), "EX", redisStatusTtlSeconds);
    if (state) {
      transaction.set(
        playerStateKey(player.guildId),
        JSON.stringify(state),
        "EX",
        redisRecoveryTtlSeconds
      );
    }
    await transaction.exec().catch(() => null);
  }

  private async persistNodeState() {
    const state = {
      available: Boolean(this.manager),
      nodeConnected: Boolean(this.manager?.useable || this.nodeConnected),
      spotifyConfigured: this.spotifyConfigured,
      redisAvailable: Boolean(this.context.redis),
      updatedAt: new Date().toISOString()
    };
    await this.context.redis
      ?.set(nodeStateKey, JSON.stringify(state), "EX", redisStatusTtlSeconds)
      .catch(() => null);
  }

  private async refreshSessionState() {
    const node = this.manager?.nodeManager.nodes.get("hydrava-main");
    const currentSessionId = node?.sessionId;

    if (currentSessionId) {
      await this.context.redis
        ?.set(sessionKey, currentSessionId, "EX", redisRecoveryTtlSeconds)
        .catch(() => null);
    }
  }

  private async clearRedisPlayer(guildId: string) {
    await this.context.redis
      ?.del(statusKey(guildId), playerStateKey(guildId), queueKey(guildId))
      .catch(() => null);
  }

  private async destroyPlayer(player: Player, reason: string) {
    await this.markControlStopped(player);
    await player.destroy(reason, true).catch(() => null);
    await this.clearRedisPlayer(player.guildId);
    this.sessions.delete(player.guildId);
  }

  private async markControlStopped(player: Player) {
    const session = this.sessions.get(player.guildId);

    if (!session?.controlMessageId || !player.textChannelId) {
      return;
    }

    const channel = await this.context.client.channels
      .fetch(player.textChannelId)
      .catch(() => null);

    if (!channel?.isTextBased() || !("messages" in channel)) {
      return;
    }

    const message = await channel.messages.fetch(session.controlMessageId).catch(() => null);
    await message
      ?.edit({
        embeds: [
          new EmbedBuilder()
            .setColor(0x64748b)
            .setTitle("播放器已停止")
            .setDescription("Hydrava 已停止播放並離開語音頻道。")
        ],
        components: []
      })
      .catch(() => null);
  }

  private async notifyPlayerChannel(player: Player, content: string) {
    if (!player.textChannelId) {
      return;
    }

    const channel = await this.context.client.channels
      .fetch(player.textChannelId)
      .catch(() => null);

    if (channel?.isTextBased() && "send" in channel) {
      await channel.send({ content }).catch(() => null);
    }
  }

  private cleanupPendingSearches() {
    const now = Date.now();
    for (const [nonce, pending] of this.pendingSearches) {
      if (pending.expiresAt <= now) {
        this.pendingSearches.delete(nonce);
      }
    }
  }

  private async respond(
    interaction: ChatInputCommandInteraction | ButtonInteraction,
    content: string
  ) {
    if (interaction.isButton()) {
      await interaction.reply({
        content,
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      content,
      ephemeral: true
    });
  }
}

function formatDuration(durationMs: number | undefined, isStream: boolean | undefined) {
  if (isStream) {
    return "直播";
  }

  const totalSeconds = Math.max(0, Math.floor((durationMs ?? 0) / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    : `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function loopModeLabel(mode: RepeatMode) {
  return mode === "track" ? "單曲" : mode === "queue" ? "佇列" : "關閉";
}
