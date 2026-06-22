"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { BirthdaySettings } from "@guildforge/shared";

import { DiscordChannelSelect } from "@/components/discord-resource-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type DashboardBirthday = {
  userId: string;
  month: number;
  day: number;
  year: number | null;
};

export function BirthdaySettingsForm({
  guildId,
  settings,
  birthdays
}: {
  guildId: string;
  settings: BirthdaySettings;
  birthdays: DashboardBirthday[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = useState(settings);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch(`/api/guilds/${guildId}/birthdays`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(local)
    });

    setMessage(response.ok ? "已儲存生日設定。" : "無法儲存生日設定。");
    if (response.ok) startTransition(() => router.refresh());
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <form className="grid gap-4" onSubmit={onSubmit}>
        <label className="grid gap-2 text-sm font-medium">
          生日公告頻道
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
          祝福訊息
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
            可使用：{"{user}"}、{"{username}"}、{"{server}"}、{"{age}"}
          </span>
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            時區
            <Input
              value={local.timeZone}
              onChange={(event) =>
                setLocal((current) => ({ ...current, timeZone: event.target.value }))
              }
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            即將到來顯示天數
            <Input
              type="number"
              min={1}
              max={90}
              value={local.upcomingDays}
              onChange={(event) =>
                setLocal((current) => ({
                  ...current,
                  upcomingDays: Number(event.target.value)
                }))
              }
            />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            <Save size={16} aria-hidden="true" />
            儲存
          </Button>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </div>
      </form>
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">已登記生日</p>
          <p className="mt-1 text-xs text-muted-foreground">
            成員可使用「/生日 設定」自行登記。
          </p>
        </div>
        {birthdays.length > 0 ? (
          birthdays.slice(0, 20).map((birthday) => (
            <div
              key={birthday.userId}
              className="flex items-center justify-between rounded-md border border-border p-3 text-sm"
            >
              <span className="font-medium">{birthday.userId}</span>
              <span className="text-muted-foreground">
                {birthday.month}/{birthday.day}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">目前尚無生日資料。</p>
        )}
      </div>
    </div>
  );
}
