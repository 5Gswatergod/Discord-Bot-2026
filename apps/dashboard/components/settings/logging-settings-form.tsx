"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { GuildLogEvent } from "@guildforge/shared";
import { logEventLabels } from "@guildforge/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LoggingSettingsFormProps = {
  guildId: string;
  configs: Array<{
    event: GuildLogEvent;
    enabled: boolean;
    channelId: string | null;
  }>;
};

export function LoggingSettingsForm({ guildId, configs }: LoggingSettingsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localConfigs, setLocalConfigs] = useState(configs);
  const [message, setMessage] = useState<string | null>(null);

  function updateConfig(event: GuildLogEvent, patch: Partial<(typeof localConfigs)[number]>) {
    setLocalConfigs((current) =>
      current.map((config) => (config.event === event ? { ...config, ...patch } : config))
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch(`/api/guilds/${guildId}/logging`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        configs: localConfigs.map((config) => ({
          ...config,
          channelId: config.channelId || null
        }))
      })
    });

    if (!response.ok) {
      setMessage("無法儲存伺服器紀錄設定。");
      return;
    }

    setMessage("已儲存。");
    startTransition(() => router.refresh());
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      {localConfigs.map((config) => (
        <div key={config.event} className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-[1fr_1.4fr_auto] md:items-center">
          <label className="flex items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={config.enabled}
              onChange={(event) => updateConfig(config.event, { enabled: event.target.checked })}
            />
            {logEventLabels[config.event]}
          </label>
          <Input
            value={config.channelId ?? ""}
            onChange={(event) => updateConfig(config.event, { channelId: event.target.value })}
            placeholder="頻道 ID"
          />
        </div>
      ))}
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
