import type { Player, Track, UnresolvedTrack } from "lavalink-client";

import type { MusicStatus } from "@guildforge/shared";

type MusicRequester = {
  id: string;
  username: string;
};

type MusicTrack = Track | UnresolvedTrack;

const allowedYoutubeHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be"
]);

export class MusicUserError extends Error {}

export function classifyMusicQuery(query: string) {
  const trimmed = query.trim();

  if (!trimmed) {
    throw new MusicUserError("請輸入歌曲名稱或連結。");
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    if (/^[a-z][a-z0-9+.-]*:(?:\/\/|\S)/i.test(trimmed) || trimmed.startsWith("//")) {
      throw new MusicUserError("只接受 HTTPS 音樂連結。");
    }

    return {
      type: "search" as const,
      query: trimmed
    };
  }

  let url: URL;

  try {
    url = new URL(trimmed);
  } catch {
    throw new MusicUserError("歌曲連結格式不正確。");
  }

  if (url.protocol !== "https:") {
    throw new MusicUserError("只接受 HTTPS 音樂連結。");
  }

  const hostname = url.hostname.toLowerCase();

  if (allowedYoutubeHosts.has(hostname)) {
    return {
      type: "youtube" as const,
      query: url.toString()
    };
  }

  if (hostname === "open.spotify.com") {
    return {
      type: "spotify" as const,
      query: url.toString()
    };
  }

  throw new MusicUserError("只支援 YouTube、YouTube Music、youtu.be 與 Spotify 連結。");
}

export function computeSkipThreshold(listenerCount: number) {
  return Math.floor(Math.max(1, listenerCount) / 2) + 1;
}

export function computeQueueAllowance(input: {
  requestedTracks: number;
  currentQueueSize: number;
  requesterTrackCount: number;
  maxQueueSize: number;
  maxTracksPerUser: number;
}) {
  return Math.max(
    0,
    Math.min(
      input.requestedTracks,
      input.maxQueueSize - input.currentQueueSize,
      input.maxTracksPerUser - input.requesterTrackCount
    )
  );
}

export function serializeMusicStatus(
  player: Player,
  options: {
    nodeConnected: boolean;
    spotifyConfigured: boolean;
    redisAvailable: boolean;
  }
): MusicStatus {
  return {
    available: true,
    redisAvailable: options.redisAvailable,
    spotifyConfigured: options.spotifyConfigured,
    nodeConnected: options.nodeConnected,
    voiceChannelId: player.voiceChannelId,
    textChannelId: player.textChannelId,
    paused: player.paused,
    volume: Math.round(player.volume),
    loopMode: player.repeatMode,
    positionMs: Math.max(0, Math.round(player.position)),
    currentTrack: serializeTrack(player.queue.current),
    queueSize: player.queue.tracks.length,
    upcomingTracks: player.queue.tracks.slice(0, 10).map(serializeTrack).filter(isPresent),
    updatedAt: new Date().toISOString()
  };
}

export function getRequesterId(track: MusicTrack | null | undefined) {
  const requester = track?.requester as Partial<MusicRequester> | undefined;
  return typeof requester?.id === "string" && /^\d{5,25}$/.test(requester.id) ? requester.id : null;
}

function serializeTrack(track: MusicTrack | null) {
  if (!track) {
    return null;
  }

  return {
    title: track.info.title,
    author: track.info.author ?? "Unknown",
    uri: track.info.uri || null,
    artworkUrl: track.info.artworkUrl ?? null,
    durationMs: Math.max(0, Math.round(track.info.duration ?? 0)),
    isStream: Boolean(track.info.isStream),
    requesterId: getRequesterId(track)
  };
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}
