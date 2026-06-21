"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { InviteTrackingSettings } from "@guildforge/shared";

import { DiscordChannelSelect } from "@/components/discord-resource-picker";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type InviteLeaderboardEntry = {
  userId: string;
  count: number;
};

export function InviteTrackingForm({
  guildId,
  settings,
  leaderboard
}: {
  guildId: string;
  settings: InviteTrackingSettings;
  leaderboard: InviteLeaderboardEntry[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = useState(settings);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch(`/api/guilds/${guildId}/invite-tracking`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(local)
    });

    setMessage(response.ok ? "已儲存邀請追蹤設定。" : "無法儲存邀請追蹤設定。");

    if (response.ok) {
      startTransition(() => router.refresh());
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <form className="grid gap-4" onSubmit={onSubmit}>
        <label className="grid gap-2 text-sm font-medium">
          加入公告頻道
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
        <label className="grid gap-2 text-sm font-medium">
          公告訊息
          <Textarea
            value={local.announcementMessage}
            onChange={(event) =>
              setLocal((current) => ({
                ...current,
                announcementMessage: event.target.value
              }))
            }
          />
          <span className="text-xs font-normal text-muted-foreground">
            可使用：{"{member}"}、{"{inviter}"}、{"{count}"}、{"{server}"}
          </span>
        </label>
        <label className="flex items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={local.trackBots}
            onChange={(event) =>
              setLocal((current) => ({ ...current, trackBots: event.target.checked }))
            }
          />
          追蹤機器人帳號加入
        </label>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            <Save size={16} aria-hidden="true" />
            儲存
          </Button>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </div>
      </form>
      <div className="space-y-3">
        <p className="text-sm font-medium">邀請排行榜</p>
        {leaderboard.length > 0 ? (
          leaderboard.map((entry, index) => (
            <div
              key={entry.userId}
              className="flex items-center justify-between rounded-md border border-border p-3 text-sm"
            >
              <span className="font-medium">
                #{index + 1} {entry.userId}
              </span>
              <span className="text-muted-foreground">{entry.count} 人</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">目前尚無邀請歸因紀錄。</p>
        )}
      </div>
    </div>
  );
}
