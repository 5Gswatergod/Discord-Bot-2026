"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { StarboardSettings } from "@guildforge/shared";

import {
  DiscordChannelMultiSelect,
  DiscordChannelSelect
} from "@/components/discord-resource-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function StarboardSettingsForm({
  guildId,
  settings
}: {
  guildId: string;
  settings: StarboardSettings;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = useState(settings);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch(`/api/guilds/${guildId}/starboard`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(local)
    });

    setMessage(response.ok ? "已儲存熱門訊息牆設定。" : "無法儲存熱門訊息牆設定。");
    if (response.ok) startTransition(() => router.refresh());
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-medium">
          展示頻道
          <DiscordChannelSelect
            value={local.channelId ?? ""}
            onValueChange={(channelId) =>
              setLocal((current) => ({ ...current, channelId: channelId || null }))
            }
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          反應 Emoji
          <Input
            value={local.emoji}
            onChange={(event) => setLocal((current) => ({ ...current, emoji: event.target.value }))}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          所需反應數
          <Input
            type="number"
            min={1}
            max={100}
            value={local.threshold}
            onChange={(event) =>
              setLocal((current) => ({ ...current, threshold: Number(event.target.value) }))
            }
          />
        </label>
      </div>
      <label className="grid gap-2 text-sm font-medium">
        忽略頻道
        <DiscordChannelMultiSelect
          values={local.ignoredChannelIds}
          onValuesChange={(ignoredChannelIds) =>
            setLocal((current) => ({ ...current, ignoredChannelIds }))
          }
          ariaLabel="選擇熱門訊息牆忽略頻道"
        />
      </label>
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={local.allowSelfStar}
            onChange={(event) =>
              setLocal((current) => ({ ...current, allowSelfStar: event.target.checked }))
            }
          />
          允許作者為自己加星
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={local.removeBelowThreshold}
            onChange={(event) =>
              setLocal((current) => ({
                ...current,
                removeBelowThreshold: event.target.checked
              }))
            }
          />
          低於門檻時移除展示
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
