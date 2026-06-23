"use client";

import { Music2, Save } from "lucide-react";
import { useEffect, useState } from "react";

import type { MusicSettings, MusicStatus } from "@guildforge/shared";

import {
  DiscordChannelMultiSelect,
  DiscordChannelSelect,
  DiscordRoleSelect
} from "@/components/discord-resource-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function MusicSettingsForm({
  guildId,
  settings
}: {
  guildId: string;
  settings: MusicSettings;
}) {
  const [local, setLocal] = useState(settings);
  const [status, setStatus] = useState<MusicStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;

    async function loadStatus() {
      if (document.visibilityState === "hidden") {
        return;
      }

      const response = await fetch(`/api/guilds/${guildId}/music/status`, {
        cache: "no-store"
      }).catch(() => null);
      const body = response?.ok ? ((await response.json()) as MusicStatus) : null;

      if (active && body) {
        setStatus(body);
      }
    }

    const schedule = () => {
      window.clearInterval(timer);
      if (document.visibilityState === "visible") {
        void loadStatus();
        timer = window.setInterval(() => void loadStatus(), 5_000);
      }
    };

    schedule();
    document.addEventListener("visibilitychange", schedule);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [guildId]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setPending(true);

    try {
      const response = await fetch(`/api/guilds/${guildId}/music`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(local)
      });
      const body = (await response.json().catch(() => null)) as {
        settings?: MusicSettings;
        error?: string;
      } | null;

      if (!response.ok || !body?.settings) {
        setMessage(body?.error ?? "無法儲存音樂播放器設定。");
        return;
      }

      setLocal(body.settings);
      setMessage("已儲存音樂播放器設定。");
    } catch {
      setMessage("無法連線至 Dashboard API，請稍後再試。");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6">
      <MusicStatusPanel status={status} />

      <form className="grid gap-5" onSubmit={onSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            DJ 身分組
            <DiscordRoleSelect
              value={local.djRoleId ?? ""}
              onValueChange={(djRoleId) =>
                setLocal((current) => ({
                  ...current,
                  djRoleId: djRoleId || null
                }))
              }
            />
            <span className="text-xs font-normal text-muted-foreground">
              DJ 與具管理伺服器權限的成員可強制控制播放器。
            </span>
          </label>

          <label className="grid gap-2 text-sm font-medium">
            播放公告頻道
            <DiscordChannelSelect
              value={local.announcementChannelId ?? ""}
              onValueChange={(announcementChannelId) =>
                setLocal((current) => ({
                  ...current,
                  announcementChannelId: announcementChannelId || null
                }))
              }
            />
          </label>
        </div>

        <label className="grid gap-2 text-sm font-medium">
          允許點歌的頻道
          <DiscordChannelMultiSelect
            values={local.requestChannelIds}
            onValuesChange={(requestChannelIds) =>
              setLocal((current) => ({
                ...current,
                requestChannelIds
              }))
            }
            ariaLabel="選擇允許點歌的頻道"
          />
          <span className="text-xs font-normal text-muted-foreground">
            未選擇時可在任何文字頻道使用音樂指令。
          </span>
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <NumberSetting
            label="預設音量"
            value={local.defaultVolume}
            min={1}
            max={100}
            suffix="%"
            onChange={(defaultVolume) => setLocal((current) => ({ ...current, defaultVolume }))}
          />
          <NumberSetting
            label="最大音量"
            value={local.maxVolume}
            min={1}
            max={100}
            suffix="%"
            onChange={(maxVolume) => setLocal((current) => ({ ...current, maxVolume }))}
          />
          <NumberSetting
            label="每位成員最多歌曲"
            value={local.maxTracksPerUser}
            min={1}
            max={100}
            suffix="首"
            onChange={(maxTracksPerUser) =>
              setLocal((current) => ({ ...current, maxTracksPerUser }))
            }
          />
          <NumberSetting
            label="佇列歌曲上限"
            value={local.maxQueueSize}
            min={10}
            max={500}
            suffix="首"
            onChange={(maxQueueSize) => setLocal((current) => ({ ...current, maxQueueSize }))}
          />
          <NumberSetting
            label="播放清單單次上限"
            value={local.playlistTrackLimit}
            min={1}
            max={200}
            suffix="首"
            onChange={(playlistTrackLimit) =>
              setLocal((current) => ({ ...current, playlistTrackLimit }))
            }
          />
          <NumberSetting
            label="無人自動離開"
            value={local.emptyChannelTimeoutSeconds}
            min={30}
            max={900}
            suffix="秒"
            onChange={(emptyChannelTimeoutSeconds) =>
              setLocal((current) => ({ ...current, emptyChannelTimeoutSeconds }))
            }
          />
          <NumberSetting
            label="空佇列自動離開"
            value={local.idleTimeoutSeconds}
            min={30}
            max={1_800}
            suffix="秒"
            onChange={(idleTimeoutSeconds) =>
              setLocal((current) => ({ ...current, idleTimeoutSeconds }))
            }
          />
        </div>

        <label className="flex items-center gap-3 rounded-md border border-border p-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={local.allowLiveStreams}
            onChange={(event) =>
              setLocal((current) => ({
                ...current,
                allowLiveStreams: event.target.checked
              }))
            }
          />
          允許播放 YouTube 直播
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            <Save size={16} aria-hidden="true" />
            儲存設定
          </Button>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </div>
      </form>
    </div>
  );
}

function MusicStatusPanel({ status }: { status: MusicStatus | null }) {
  return (
    <div className="rounded-xl border border-border bg-muted/35 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Music2 size={20} aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold">播放器即時狀態</p>
          <p className="text-xs text-muted-foreground">
            {status ? new Date(status.updatedAt).toLocaleString("zh-TW") : "正在讀取狀態…"}
          </p>
        </div>
      </div>

      {status ? (
        <div className="mt-4 grid gap-4">
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <StatusItem label="Lavalink" value={status.nodeConnected ? "已連線" : "未連線"} />
            <StatusItem
              label="Spotify"
              value={status.spotifyConfigured ? "已設定" : "未設定（YouTube 可用）"}
            />
            <StatusItem label="Redis 狀態" value={status.redisAvailable ? "正常" : "不可用"} />
            <StatusItem label="佇列" value={`${status.queueSize} 首`} />
            <StatusItem
              label="音訊來源"
              value={
                status.deliveryMode === "temporary_file"
                  ? "暫存檔播放"
                  : status.deliveryMode === "live_stream"
                    ? "YouTube 直播"
                    : "待命"
              }
            />
            <StatusItem label="下載狀態" value={downloadStateLabel(status.downloadState)} />
            <StatusItem label="暫存空間" value={formatBytes(status.temporaryStorageBytes)} />
            <StatusItem
              label="目前歌曲"
              value={
                status.currentTrack
                  ? `${status.currentTrack.title} · ${status.currentTrack.author}`
                  : "未播放"
              }
              className="sm:col-span-2"
            />
            <StatusItem
              label="播放進度"
              value={
                status.currentTrack
                  ? status.currentTrack.isStream
                    ? "直播"
                    : `${formatDuration(status.positionMs)} / ${formatDuration(
                        status.currentTrack.durationMs
                      )}`
                  : "—"
              }
            />
            <StatusItem
              label="播放器"
              value={
                status.currentTrack
                  ? `${status.paused ? "已暫停" : "播放中"} · 音量 ${status.volume}%`
                  : "待命"
              }
            />
            <StatusItem label="語音頻道" value={status.voiceChannelId ? "已連線" : "未連線"} />
            <StatusItem label="循環模式" value={loopModeLabel(status.loopMode)} />
          </div>

          {status.preparingTrack ? (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
              <p className="text-xs text-muted-foreground">正在準備／預載</p>
              <p className="mt-1 font-medium">
                {status.preparingTrack.title} · {status.preparingTrack.author}
              </p>
            </div>
          ) : null}

          {status.upcomingTracks.length > 0 ? (
            <div className="rounded-md border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">接下來播放</p>
              <ol className="mt-2 grid gap-2 text-sm">
                {status.upcomingTracks.slice(0, 5).map((track, index) => (
                  <li className="flex min-w-0 items-center gap-3" key={`${track.uri}-${index}`}>
                    <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{track.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {track.isStream ? "直播" : formatDuration(track.durationMs)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StatusItem({
  label,
  value,
  className = ""
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`rounded-md border border-border bg-card p-3 ${className}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-medium">{value}</p>
    </div>
  );
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    : `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function loopModeLabel(mode: MusicStatus["loopMode"]) {
  return mode === "track" ? "單曲循環" : mode === "queue" ? "佇列循環" : "關閉";
}

function downloadStateLabel(state: MusicStatus["downloadState"]) {
  switch (state) {
    case "queued":
      return "等待下載";
    case "downloading":
      return "下載中";
    case "ready":
      return "已準備";
    case "failed":
      return "準備失敗";
    default:
      return "閒置";
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(bytes > 0 ? 1 : 0)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function NumberSetting({
  label,
  value,
  min,
  max,
  suffix,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="shrink-0 text-xs font-normal text-muted-foreground">{suffix}</span>
      </div>
    </label>
  );
}
