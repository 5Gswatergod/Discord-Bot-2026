import { NextResponse } from "next/server";

import { musicStatusSchema, type MusicStatus } from "@guildforge/shared";

import { requireGuildApiAccess } from "@/lib/api-auth";
import { ensureRedisConnection } from "@/lib/redis";

type RouteContext = {
  params: Promise<{
    guildId: string;
  }>;
};

const nodeStateKey = "hydrava:music:node";
const statusKey = (guildId: string) => `hydrava:music:status:${guildId}`;

export async function GET(_request: Request, { params: paramsPromise }: RouteContext) {
  const params = await paramsPromise;
  const access = await requireGuildApiAccess(params.guildId);

  if (!access.ok) {
    return access.response;
  }

  try {
    const redis = await ensureRedisConnection();
    const [nodeRaw, statusRaw] = await redis.mget(nodeStateKey, statusKey(params.guildId));
    const node = nodeRaw
      ? (JSON.parse(nodeRaw) as {
          available?: boolean;
          redisAvailable?: boolean;
          spotifyConfigured?: boolean;
          nodeConnected?: boolean;
          updatedAt?: string;
        })
      : null;

    if (statusRaw) {
      const parsed = musicStatusSchema.safeParse(JSON.parse(statusRaw));
      if (parsed.success) {
        return NextResponse.json(parsed.data);
      }
    }

    return NextResponse.json(
      inactiveStatus({
        available: node?.available ?? false,
        redisAvailable: true,
        spotifyConfigured: node?.spotifyConfigured ?? false,
        nodeConnected: node?.nodeConnected ?? false,
        updatedAt: node?.updatedAt
      })
    );
  } catch {
    return NextResponse.json(
      inactiveStatus({
        available: false,
        redisAvailable: false,
        spotifyConfigured: false,
        nodeConnected: false
      })
    );
  }
}

function inactiveStatus(overrides: {
  available: boolean;
  redisAvailable: boolean;
  spotifyConfigured: boolean;
  nodeConnected: boolean;
  updatedAt?: string;
}): MusicStatus {
  return {
    available: overrides.available,
    redisAvailable: overrides.redisAvailable,
    spotifyConfigured: overrides.spotifyConfigured,
    nodeConnected: overrides.nodeConnected,
    voiceChannelId: null,
    textChannelId: null,
    paused: false,
    volume: 0,
    loopMode: "off",
    positionMs: 0,
    currentTrack: null,
    queueSize: 0,
    upcomingTracks: [],
    deliveryMode: null,
    downloadState: "idle",
    preparingTrack: null,
    temporaryStorageBytes: 0,
    updatedAt: overrides.updatedAt ?? new Date().toISOString()
  };
}
