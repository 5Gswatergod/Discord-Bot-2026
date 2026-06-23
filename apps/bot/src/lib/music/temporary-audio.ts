import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

export type TemporaryAudioTrack = {
  id: string;
  title: string;
  author: string;
  uri: string | null;
  isrc: string | null;
  durationMs: number;
  sourceType: "youtube" | "spotify";
};

export type PreparedAudio = {
  trackId: string;
  fileName: string;
  filePath: string;
  lavalinkUri: string;
  sizeBytes: number;
};

export type TemporaryAudioPriority = "current" | "prefetch";

export type CommandResult = {
  stdout: string;
  stderr: string;
};

export type CommandRunner = (
  command: string,
  args: string[],
  options: {
    signal: AbortSignal;
    timeoutMs: number;
  }
) => Promise<CommandResult>;

export type TemporaryAudioOptions = {
  executable: string;
  directory: string;
  lavalinkLocalPrefix: string;
  concurrency: number;
  timeoutMs: number;
  maxFileBytes: number;
  maxStorageBytes: number;
  maxDurationSeconds: number;
  orphanMaxAgeMs: number;
  runner?: CommandRunner;
};

type DownloadJob = {
  track: TemporaryAudioTrack;
  priority: TemporaryAudioPriority;
  controller: AbortController;
  resolve: (audio: PreparedAudio) => void;
  reject: (error: Error) => void;
};

type YtDlpEntry = {
  id?: string;
  title?: string;
  uploader?: string;
  channel?: string;
  duration?: number;
  webpage_url?: string;
  original_url?: string;
  url?: string;
};

const youtubeHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be"
]);

export class TemporaryAudioError extends Error {}

export class TemporaryAudioManager {
  private readonly runner: CommandRunner;
  private readonly queue: DownloadJob[] = [];
  private readonly jobs = new Map<string, Promise<PreparedAudio>>();
  private readonly controllers = new Map<string, AbortController>();
  private readonly prepared = new Map<string, PreparedAudio>();
  private activeCount = 0;
  private reservedBytes = 0;

  constructor(private readonly options: TemporaryAudioOptions) {
    this.runner = options.runner ?? runCommand;
  }

  async initialize(referencedPaths: ReadonlySet<string> = new Set()) {
    await this.cleanup(referencedPaths, true);
  }

  async cleanupOrphans(referencedPaths: ReadonlySet<string> = new Set()) {
    await this.cleanup(referencedPaths, false);
  }

  private async cleanup(referencedPaths: ReadonlySet<string>, removeIncompleteFiles: boolean) {
    await mkdir(this.options.directory, { recursive: true });
    const now = Date.now();

    for (const entry of await readdir(this.options.directory, { withFileTypes: true })) {
      if (!entry.isFile()) {
        continue;
      }

      const filePath = this.safePath(entry.name);
      if (
        removeIncompleteFiles &&
        (entry.name.includes(".part") || entry.name.includes(".download."))
      ) {
        await rm(filePath, { force: true });
        continue;
      }

      if (entry.name.includes(".part") || entry.name.includes(".download.")) {
        continue;
      }

      if (referencedPaths.has(filePath)) {
        continue;
      }

      const details = await stat(filePath).catch(() => null);
      if (details && now - details.mtimeMs >= this.options.orphanMaxAgeMs) {
        await rm(filePath, { force: true });
      }
    }
  }

  prepare(track: TemporaryAudioTrack, priority: TemporaryAudioPriority) {
    const existing = this.prepared.get(track.id);
    if (existing) {
      return Promise.resolve(existing);
    }

    const running = this.jobs.get(track.id);
    if (running) {
      return running;
    }

    if (track.durationMs > this.options.maxDurationSeconds * 1_000) {
      return Promise.reject(
        new TemporaryAudioError(
          `歌曲長度超過 ${Math.floor(this.options.maxDurationSeconds / 3_600)} 小時限制。`
        )
      );
    }

    const controller = new AbortController();
    const promise = new Promise<PreparedAudio>((resolve, reject) => {
      const job = { track, priority, controller, resolve, reject };
      if (priority === "current") {
        const firstPrefetch = this.queue.findIndex((queued) => queued.priority === "prefetch");
        if (firstPrefetch < 0) {
          this.queue.push(job);
        } else {
          this.queue.splice(firstPrefetch, 0, job);
        }
      } else {
        this.queue.push(job);
      }
      this.controllers.set(track.id, controller);
      this.pump();
    }).finally(() => {
      this.jobs.delete(track.id);
      this.controllers.delete(track.id);
    });

    this.jobs.set(track.id, promise);
    return promise;
  }

  async cancel(trackId: string) {
    this.controllers.get(trackId)?.abort();
    const queuedIndex = this.queue.findIndex((job) => job.track.id === trackId);
    if (queuedIndex >= 0) {
      const [job] = this.queue.splice(queuedIndex, 1);
      job?.reject(new TemporaryAudioError("歌曲準備已取消。"));
    }
    await this.release(trackId);
  }

  async release(trackId: string) {
    const audio = this.prepared.get(trackId);
    this.prepared.delete(trackId);
    if (audio) {
      await rm(audio.filePath, { force: true });
    }
  }

  registerPrepared(audio: PreparedAudio) {
    this.prepared.set(audio.trackId, audio);
  }

  getPrepared(trackId: string) {
    return this.prepared.get(trackId) ?? null;
  }

  async storageBytes() {
    await mkdir(this.options.directory, { recursive: true });
    let total = 0;
    for (const entry of await readdir(this.options.directory, { withFileTypes: true })) {
      if (!entry.isFile()) {
        continue;
      }
      total += (await stat(this.safePath(entry.name)).catch(() => null))?.size ?? 0;
    }
    return total;
  }

  async close(options: { preservePrepared: boolean }) {
    for (const controller of this.controllers.values()) {
      controller.abort();
    }
    this.queue
      .splice(0)
      .forEach((job) => job.reject(new TemporaryAudioError("音樂下載器正在關閉。")));
    if (!options.preservePrepared) {
      await Promise.all([...this.prepared.keys()].map((trackId) => this.release(trackId)));
    }
  }

  private pump() {
    while (this.activeCount < this.options.concurrency && this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) {
        return;
      }
      if (job.controller.signal.aborted) {
        job.reject(new TemporaryAudioError("歌曲準備已取消。"));
        continue;
      }

      this.activeCount += 1;
      void this.download(job.track, job.controller.signal)
        .then((audio) => {
          this.prepared.set(job.track.id, audio);
          job.resolve(audio);
        })
        .catch((error: unknown) => {
          job.reject(error instanceof Error ? error : new TemporaryAudioError(String(error)));
        })
        .finally(() => {
          this.activeCount -= 1;
          this.pump();
        });
    }
  }

  private async download(track: TemporaryAudioTrack, signal: AbortSignal) {
    const usedBytes = await this.storageBytes();
    if (usedBytes + this.reservedBytes + this.options.maxFileBytes > this.options.maxStorageBytes) {
      throw new TemporaryAudioError("音樂暫存空間已達上限，請稍後再試。");
    }
    this.reservedBytes += this.options.maxFileBytes;

    try {
      const directUrl =
        track.sourceType === "youtube" && track.uri && isAllowedYoutubeUrl(track.uri)
          ? track.uri
          : null;
      const attempts: string[] = [];
      if (directUrl) {
        try {
          return await this.downloadUrl(track, directUrl, signal);
        } catch {
          if (signal.aborted) {
            throw new TemporaryAudioError("歌曲準備已取消。");
          }
        }
      }

      const searchQueries = buildSearchQueries(track);
      for (const query of searchQueries) {
        try {
          const candidates = await this.search(query, signal);
          for (const candidate of rankCandidates(track, candidates)) {
            const url = candidateUrl(candidate);
            if (url && url !== directUrl && !attempts.includes(url)) {
              attempts.push(url);
            }
          }
        } catch {
          if (signal.aborted) {
            throw new TemporaryAudioError("歌曲準備已取消。");
          }
        }
      }

      if (attempts.length === 0) {
        throw new TemporaryAudioError("找不到可供暫存播放的 YouTube 版本。");
      }

      let lastError: unknown = null;
      for (const url of attempts) {
        try {
          return await this.downloadUrl(track, url, signal);
        } catch (error) {
          lastError = error;
          if (signal.aborted) {
            throw new TemporaryAudioError("歌曲準備已取消。");
          }
        }
      }

      throw new TemporaryAudioError(
        `所有可用版本皆下載失敗：${lastError instanceof Error ? lastError.message : "未知錯誤"}`
      );
    } finally {
      this.reservedBytes = Math.max(0, this.reservedBytes - this.options.maxFileBytes);
    }
  }

  private async search(query: string, signal: AbortSignal) {
    const result = await this.runner(
      this.options.executable,
      [
        "--no-config",
        "--skip-download",
        "--flat-playlist",
        "--dump-single-json",
        "--playlist-end",
        "5",
        "--js-runtimes",
        "node",
        `ytsearch5:${query}`
      ],
      { signal, timeoutMs: this.options.timeoutMs }
    );

    const parsed = JSON.parse(result.stdout) as YtDlpEntry & { entries?: YtDlpEntry[] };
    return Array.isArray(parsed.entries) ? parsed.entries : [parsed];
  }

  private async downloadUrl(track: TemporaryAudioTrack, url: string, signal: AbortSignal) {
    if (!isAllowedYoutubeUrl(url)) {
      throw new TemporaryAudioError("下載候選不是允許的 YouTube 網址。");
    }

    const token = randomUUID();
    const outputTemplate = `${token}.download.%(ext)s`;
    let completed = false;
    try {
      const result = await this.runner(
        this.options.executable,
        buildDownloadArgs({
          directory: this.options.directory,
          outputTemplate,
          maxFileBytes: this.options.maxFileBytes,
          maxDurationSeconds: this.options.maxDurationSeconds,
          url
        }),
        { signal, timeoutMs: this.options.timeoutMs }
      );

      const reportedPath = result.stdout
        .trim()
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .at(-1);
      if (!reportedPath) {
        throw new TemporaryAudioError("yt-dlp 未回報完成檔案。");
      }

      const sourcePath = this.safePath(path.basename(reportedPath));
      const finalName = `${token}.opus`;
      const finalPath = this.safePath(finalName);
      const details = await stat(sourcePath);
      if (details.size > this.options.maxFileBytes) {
        throw new TemporaryAudioError("歌曲檔案超過單檔容量限制。");
      }

      const currentStorage = await this.storageBytes();
      if (currentStorage > this.options.maxStorageBytes) {
        throw new TemporaryAudioError("音樂暫存空間已達上限。");
      }

      await rename(sourcePath, finalPath);
      completed = true;
      const prefix = this.options.lavalinkLocalPrefix.replace(/\/+$/, "");
      return {
        trackId: track.id,
        fileName: finalName,
        filePath: finalPath,
        lavalinkUri: `${prefix}/${finalName}`,
        sizeBytes: details.size
      } satisfies PreparedAudio;
    } finally {
      if (!completed) {
        await this.removeTokenFiles(token);
      }
    }
  }

  private safePath(fileName: string) {
    const root = path.resolve(this.options.directory);
    const resolved = path.resolve(root, fileName);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
      throw new TemporaryAudioError("拒絕存取暫存目錄之外的路徑。");
    }
    return resolved;
  }

  private async removeTokenFiles(token: string) {
    for (const entry of await readdir(this.options.directory, { withFileTypes: true }).catch(
      () => []
    )) {
      if (entry.isFile() && entry.name.startsWith(token)) {
        await rm(this.safePath(entry.name), { force: true });
      }
    }
  }
}

export function buildDownloadArgs(input: {
  directory: string;
  outputTemplate: string;
  maxFileBytes: number;
  maxDurationSeconds: number;
  url: string;
}) {
  return [
    "--no-config",
    "--no-playlist",
    "--js-runtimes",
    "node",
    "--extract-audio",
    "--audio-format",
    "opus",
    "--audio-quality",
    "0",
    "--max-filesize",
    String(input.maxFileBytes),
    "--match-filter",
    `duration <= ${input.maxDurationSeconds} & !is_live`,
    "--socket-timeout",
    "30",
    "--retries",
    "3",
    "--fragment-retries",
    "3",
    "--paths",
    `home:${input.directory}`,
    "--paths",
    `temp:${input.directory}`,
    "--output",
    input.outputTemplate,
    "--print",
    "after_move:filepath",
    input.url
  ];
}

export function buildSearchQueries(track: TemporaryAudioTrack) {
  const queries: string[] = [];
  if (track.isrc) {
    queries.push(track.isrc);
  }
  queries.push(`${track.author} ${track.title}`);
  return [...new Set(queries.map((query) => query.trim()).filter(Boolean))];
}

export function rankCandidates(track: TemporaryAudioTrack, entries: YtDlpEntry[]) {
  return entries
    .map((entry) => ({ entry, score: scoreCandidate(track, entry) }))
    .filter(({ score }) => score >= 0.45)
    .sort((left, right) => right.score - left.score)
    .map(({ entry }) => entry);
}

export function scoreCandidate(track: TemporaryAudioTrack, entry: YtDlpEntry) {
  const titleScore = tokenOverlap(track.title, entry.title ?? "");
  const authorScore = tokenOverlap(track.author, entry.uploader ?? entry.channel ?? "");
  const candidateDurationMs = Math.max(0, (entry.duration ?? 0) * 1_000);
  const durationTolerance = Math.max(15_000, track.durationMs * 0.1);
  const durationScore =
    !track.durationMs || !candidateDurationMs
      ? 0.5
      : Math.abs(track.durationMs - candidateDurationMs) <= durationTolerance
        ? 1
        : Math.max(0, 1 - Math.abs(track.durationMs - candidateDurationMs) / track.durationMs);
  return titleScore * 0.55 + authorScore * 0.2 + durationScore * 0.25;
}

export function isAllowedYoutubeUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && youtubeHosts.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function candidateUrl(entry: YtDlpEntry) {
  const explicit = entry.webpage_url ?? entry.original_url;
  if (explicit && isAllowedYoutubeUrl(explicit)) {
    return explicit;
  }
  if (entry.id && /^[A-Za-z0-9_-]{6,20}$/.test(entry.id)) {
    return `https://www.youtube.com/watch?v=${entry.id}`;
  }
  return entry.url && isAllowedYoutubeUrl(entry.url) ? entry.url : null;
}

function tokenOverlap(left: string, right: string) {
  const leftTokens = normalizeTokens(left);
  const rightTokens = normalizeTokens(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }
  let matches = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      matches += 1;
    }
  }
  return matches / Math.max(leftTokens.size, rightTokens.size);
}

function normalizeTokens(value: string) {
  return new Set(
    value
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\([^)]*(official|lyrics?|audio|video)[^)]*\)/g, " ")
      .replace(/\[[^\]]*(official|lyrics?|audio|video)[^\]]*\]/g, " ")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .split(/\s+/)
      .filter((token) => token.length > 1)
  );
}

async function runCommand(
  command: string,
  args: string[],
  options: { signal: AbortSignal; timeoutMs: number }
) {
  return new Promise<CommandResult>((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, options.timeoutMs);
    const abort = () => child.kill("SIGKILL");
    options.signal.addEventListener("abort", abort, { once: true });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout = `${stdout}${chunk}`.slice(-1_000_000);
    });
    child.stderr.on("data", (chunk: string) => {
      stderr = `${stderr}${chunk}`.slice(-1_000_000);
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      options.signal.removeEventListener("abort", abort);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      options.signal.removeEventListener("abort", abort);
      if (options.signal.aborted) {
        reject(new TemporaryAudioError("歌曲準備已取消。"));
      } else if (timedOut) {
        reject(new TemporaryAudioError("歌曲下載超過時間限制。"));
      } else if (code !== 0) {
        reject(new TemporaryAudioError(stderr.trim() || `yt-dlp 結束碼 ${code}`));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}
