import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  TemporaryAudioManager,
  buildDownloadArgs,
  buildSearchQueries,
  isAllowedYoutubeUrl,
  scoreCandidate
} from "./temporary-audio";

const track = {
  id: "track-1",
  title: "Mango Jump 我喜歡你 I'm Into You",
  author: "芒果醬 Mango Jump",
  uri: "https://www.youtube.com/watch?v=example",
  isrc: "TWABC1234567",
  durationMs: 220_000,
  sourceType: "spotify" as const
};

test("builds Spotify matching queries in ISRC then artist-title order", () => {
  assert.deepEqual(buildSearchQueries(track), [
    "TWABC1234567",
    "芒果醬 Mango Jump Mango Jump 我喜歡你 I'm Into You"
  ]);
});

test("scores matching YouTube alternatives above unrelated videos", () => {
  const matching = scoreCandidate(track, {
    title: "芒果醬 Mango Jump《我喜歡你 I'm Into You》Official Music Video",
    uploader: "芒果醬 Mango Jump",
    duration: 222
  });
  const unrelated = scoreCandidate(track, {
    title: "Ten hours of rain sounds",
    uploader: "Sleep Channel",
    duration: 36_000
  });

  assert.ok(matching > unrelated);
  assert.ok(matching >= 0.45);
});

test("download arguments are shell-free, anonymous, and enforce limits", () => {
  const args = buildDownloadArgs({
    directory: "/tmp/music",
    outputTemplate: "id.download.%(ext)s",
    maxFileBytes: 512 * 1024 * 1024,
    maxDurationSeconds: 21_600,
    url: "https://youtu.be/example"
  });

  assert.ok(args.includes("--no-config"));
  assert.ok(args.includes("--no-playlist"));
  assert.ok(args.includes("node"));
  assert.ok(args.includes("duration <= 21600 & !is_live"));
  assert.ok(!args.some((arg) => /cookie|oauth|username|password/i.test(arg)));
});

test("only accepts HTTPS YouTube delivery candidates", () => {
  assert.equal(isAllowedYoutubeUrl("https://www.youtube.com/watch?v=example"), true);
  assert.equal(isAllowedYoutubeUrl("https://youtu.be/example"), true);
  assert.equal(isAllowedYoutubeUrl("http://youtube.com/watch?v=example"), false);
  assert.equal(isAllowedYoutubeUrl("https://example.com/audio"), false);
  assert.equal(isAllowedYoutubeUrl("file:///etc/passwd"), false);
});

test("prepares an atomic Opus file with an injected yt-dlp runner and deletes it", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "hydrava-music-test-"));
  try {
    const manager = new TemporaryAudioManager({
      executable: "fake-yt-dlp",
      directory,
      lavalinkLocalPrefix: "/opt/Lavalink/music",
      concurrency: 2,
      timeoutMs: 1_000,
      maxFileBytes: 1024 * 1024,
      maxStorageBytes: 4 * 1024 * 1024,
      maxDurationSeconds: 21_600,
      orphanMaxAgeMs: 900_000,
      runner: async (_command, args) => {
        const template = args[args.indexOf("--output") + 1]!;
        const outputPath = path.join(directory, template.replace("%(ext)s", "opus"));
        await writeFile(outputPath, Buffer.from("fake-opus"));
        return { stdout: `${outputPath}\n`, stderr: "" };
      }
    });

    await manager.initialize();
    const prepared = await manager.prepare(
      {
        ...track,
        sourceType: "youtube"
      },
      "current"
    );

    assert.equal(prepared.lavalinkUri.startsWith("/opt/Lavalink/music/"), true);
    assert.equal(prepared.fileName.endsWith(".opus"), true);
    assert.deepEqual(await readdir(directory), [prepared.fileName]);

    await manager.release(track.id);
    assert.deepEqual(await readdir(directory), []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("startup cleanup removes incomplete and old unreferenced files", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "hydrava-music-cleanup-"));
  const referenced = path.join(directory, "referenced.opus");
  try {
    await Promise.all([
      writeFile(path.join(directory, "abandoned.part"), "partial"),
      writeFile(path.join(directory, "abandoned.download.opus"), "partial"),
      writeFile(path.join(directory, "orphan.opus"), "old"),
      writeFile(referenced, "keep")
    ]);
    const oldDate = new Date(Date.now() - 60_000);
    await Promise.all([
      utimes(path.join(directory, "orphan.opus"), oldDate, oldDate),
      utimes(referenced, oldDate, oldDate)
    ]);

    const manager = new TemporaryAudioManager({
      executable: "fake-yt-dlp",
      directory,
      lavalinkLocalPrefix: "/opt/Lavalink/music",
      concurrency: 2,
      timeoutMs: 1_000,
      maxFileBytes: 1024 * 1024,
      maxStorageBytes: 4 * 1024 * 1024,
      maxDurationSeconds: 21_600,
      orphanMaxAgeMs: 1_000,
      runner: async () => ({ stdout: "", stderr: "" })
    });

    await manager.initialize(new Set([referenced]));
    assert.deepEqual(await readdir(directory), ["referenced.opus"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("limits concurrent downloads globally", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "hydrava-music-concurrency-"));
  let active = 0;
  let maximumActive = 0;
  try {
    const manager = new TemporaryAudioManager({
      executable: "fake-yt-dlp",
      directory,
      lavalinkLocalPrefix: "/opt/Lavalink/music",
      concurrency: 2,
      timeoutMs: 1_000,
      maxFileBytes: 1024 * 1024,
      maxStorageBytes: 8 * 1024 * 1024,
      maxDurationSeconds: 21_600,
      orphanMaxAgeMs: 900_000,
      runner: async (_command, args) => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setTimeout(resolve, 20));
        const template = args[args.indexOf("--output") + 1]!;
        const outputPath = path.join(directory, template.replace("%(ext)s", "opus"));
        await writeFile(outputPath, Buffer.from("fake-opus"));
        active -= 1;
        return { stdout: `${outputPath}\n`, stderr: "" };
      }
    });

    await manager.initialize();
    const prepared = await Promise.all(
      ["one", "two", "three"].map((id) =>
        manager.prepare(
          {
            ...track,
            id,
            uri: `https://www.youtube.com/watch?v=${id}`,
            sourceType: "youtube"
          },
          "current"
        )
      )
    );

    assert.equal(maximumActive, 2);
    await Promise.all(prepared.map((audio) => manager.release(audio.trackId)));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("cancels an active download without leaving a prepared file", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "hydrava-music-cancel-"));
  try {
    const manager = new TemporaryAudioManager({
      executable: "fake-yt-dlp",
      directory,
      lavalinkLocalPrefix: "/opt/Lavalink/music",
      concurrency: 1,
      timeoutMs: 1_000,
      maxFileBytes: 1024 * 1024,
      maxStorageBytes: 4 * 1024 * 1024,
      maxDurationSeconds: 21_600,
      orphanMaxAgeMs: 900_000,
      runner: async (_command, _args, options) =>
        new Promise((resolve, reject) => {
          if (options.signal.aborted) {
            reject(new Error("cancelled"));
            return;
          }
          options.signal.addEventListener("abort", () => reject(new Error("cancelled")), {
            once: true
          });
          setTimeout(() => resolve({ stdout: "", stderr: "" }), 500);
        })
    });

    await manager.initialize();
    const pending = manager.prepare(
      {
        ...track,
        sourceType: "youtube"
      },
      "current"
    );
    const rejected = assert.rejects(pending);
    await manager.cancel(track.id);
    await rejected;
    assert.deepEqual(await readdir(directory), []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
