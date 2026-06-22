"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { TemporaryVoiceSettings } from "@guildforge/shared";

import {
  DiscordCategorySelect,
  DiscordVoiceChannelSelect
} from "@/components/discord-resource-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TemporaryVoiceForm({
  guildId,
  settings,
  activeCount
}: {
  guildId: string;
  settings: TemporaryVoiceSettings;
  activeCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = useState(settings);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch(`/api/guilds/${guildId}/temporary-voice`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(local)
    });

    setMessage(response.ok ? "已儲存臨時語音頻道設定。" : "無法儲存臨時語音頻道設定。");
    if (response.ok) startTransition(() => router.refresh());
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <div className="rounded-md border border-border p-3 text-sm">
        目前活躍的臨時語音頻道：<strong>{activeCount}</strong>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          建立大廳
          <DiscordVoiceChannelSelect
            value={local.lobbyChannelId ?? ""}
            onValueChange={(lobbyChannelId) =>
              setLocal((current) => ({
                ...current,
                lobbyChannelId: lobbyChannelId || null
              }))
            }
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          新頻道分類
          <DiscordCategorySelect
            value={local.categoryId ?? ""}
            onValueChange={(categoryId) =>
              setLocal((current) => ({ ...current, categoryId: categoryId || null }))
            }
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          頻道名稱範本
          <Input
            value={local.nameTemplate}
            onChange={(event) =>
              setLocal((current) => ({ ...current, nameTemplate: event.target.value }))
            }
          />
          <span className="text-xs font-normal text-muted-foreground">
            可使用：{"{username}"}、{"{displayName}"}
          </span>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          預設人數限制
          <Input
            type="number"
            min={0}
            max={99}
            value={local.userLimit}
            onChange={(event) =>
              setLocal((current) => ({
                ...current,
                userLimit: Number(event.target.value)
              }))
            }
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          預設位元率（kbps）
          <Input
            type="number"
            min={8}
            max={384}
            value={local.bitrate / 1_000}
            onChange={(event) =>
              setLocal((current) => ({
                ...current,
                bitrate: Number(event.target.value) * 1_000
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
  );
}
