import assert from "node:assert/strict";
import test from "node:test";

import { musicSettingsSchema } from "@guildforge/shared";

import { musicCommands } from "./music/music";
import {
  classifyMusicQuery,
  computeQueueAllowance,
  computeSkipThreshold,
  serializeMusicStatus
} from "../lib/music/music-policy";

test("registers the complete music command surface", () => {
  const names = musicCommands.map((command) => command.data.toJSON().name);

  assert.deepEqual(names, [
    "play",
    "queue",
    "nowplaying",
    "pause",
    "resume",
    "skip",
    "remove",
    "shuffle",
    "loop",
    "volume",
    "stop"
  ]);
  assert.equal(new Set(names).size, names.length);
});

test("applies safe music defaults and validates limits", () => {
  const settings = musicSettingsSchema.parse({});

  assert.equal(settings.defaultVolume, 60);
  assert.equal(settings.maxVolume, 100);
  assert.equal(settings.emptyChannelTimeoutSeconds, 120);
  assert.equal(settings.idleTimeoutSeconds, 300);
  assert.equal(settings.maxTracksPerUser, 25);
  assert.equal(settings.maxQueueSize, 100);
  assert.equal(settings.playlistTrackLimit, 50);
  assert.equal(settings.allowLiveStreams, true);

  assert.equal(
    musicSettingsSchema.safeParse({
      defaultVolume: 90,
      maxVolume: 50
    }).success,
    false
  );
  assert.equal(
    musicSettingsSchema.safeParse({
      requestChannelIds: ["12345", "12345"]
    }).success,
    false
  );
});

test("allows only text searches and supported HTTPS music hosts", () => {
  assert.deepEqual(classifyMusicQuery("Never Gonna Give You Up"), {
    type: "search",
    query: "Never Gonna Give You Up"
  });
  assert.equal(classifyMusicQuery("lofi: hip hop").type, "search");
  assert.equal(classifyMusicQuery("https://www.youtube.com/watch?v=dQw4w9WgXcQ").type, "youtube");
  assert.equal(classifyMusicQuery("https://m.youtube.com/watch?v=dQw4w9WgXcQ").type, "youtube");
  assert.equal(classifyMusicQuery("https://youtu.be/dQw4w9WgXcQ").type, "youtube");
  assert.equal(classifyMusicQuery("https://open.spotify.com/track/example").type, "spotify");

  assert.throws(() => classifyMusicQuery("http://youtube.com/watch?v=example"));
  assert.throws(() => classifyMusicQuery("ftp://127.0.0.1/private"));
  assert.throws(() => classifyMusicQuery("https://example.com/audio.mp3"));
  assert.throws(() => classifyMusicQuery("https://127.0.0.1/private"));
});

test("calculates queue and skip limits deterministically", () => {
  assert.equal(computeSkipThreshold(1), 1);
  assert.equal(computeSkipThreshold(2), 2);
  assert.equal(computeSkipThreshold(5), 3);
  assert.equal(
    computeQueueAllowance({
      requestedTracks: 50,
      currentQueueSize: 90,
      requesterTrackCount: 20,
      maxQueueSize: 100,
      maxTracksPerUser: 25
    }),
    5
  );
  assert.equal(
    computeQueueAllowance({
      requestedTracks: 1,
      currentQueueSize: 100,
      requesterTrackCount: 0,
      maxQueueSize: 100,
      maxTracksPerUser: 25
    }),
    0
  );
});

test("serializes active player state for the dashboard", () => {
  const status = serializeMusicStatus(
    {
      voiceChannelId: "12345",
      textChannelId: "67890",
      paused: false,
      volume: 60,
      repeatMode: "queue",
      position: 12_345,
      queue: {
        current: {
          info: {
            title: "Current",
            author: "Artist",
            uri: "https://youtube.com/watch?v=current",
            artworkUrl: null,
            duration: 180_000,
            isStream: false
          },
          requester: {
            id: "11111"
          }
        },
        tracks: [
          {
            info: {
              title: "Next",
              author: "Artist",
              uri: "https://youtube.com/watch?v=next",
              artworkUrl: null,
              duration: 200_000,
              isStream: false
            },
            requester: {
              id: "22222"
            }
          }
        ]
      }
    } as never,
    {
      nodeConnected: true,
      spotifyConfigured: false,
      redisAvailable: true
    }
  );

  assert.equal(status.currentTrack?.title, "Current");
  assert.equal(status.currentTrack?.requesterId, "11111");
  assert.equal(status.queueSize, 1);
  assert.equal(status.upcomingTracks[0]?.title, "Next");
  assert.equal(status.loopMode, "queue");
});
