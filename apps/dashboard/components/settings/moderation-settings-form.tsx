"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { ModerationSettings } from "@guildforge/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ModerationSettingsFormProps = {
  guildId: string;
  settings: ModerationSettings;
};

function splitIds(value: string) {
  return value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ModerationSettingsForm({ guildId, settings }: ModerationSettingsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [moderatorRoleIds, setModeratorRoleIds] = useState(settings.moderatorRoleIds.join(", "));
  const [logChannelId, setLogChannelId] = useState(settings.logChannelId ?? "");
  const [muteRoleId, setMuteRoleId] = useState(settings.muteRoleId ?? "");
  const [defaultTimeoutSeconds, setDefaultTimeoutSeconds] = useState(
    String(settings.defaultTimeoutSeconds)
  );
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch(`/api/guilds/${guildId}/moderation`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        moderatorRoleIds: splitIds(moderatorRoleIds),
        logChannelId: logChannelId || null,
        muteRoleId: muteRoleId || null,
        defaultTimeoutSeconds: Number(defaultTimeoutSeconds)
      })
    });

    if (!response.ok) {
      setMessage("無法儲存管理功能設定。");
      return;
    }

    setMessage("已儲存。");
    startTransition(() => router.refresh());
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <label className="grid gap-2 text-sm font-medium">
        管理員身分組 ID
        <Input value={moderatorRoleIds} onChange={(event) => setModeratorRoleIds(event.target.value)} />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          紀錄頻道 ID
          <Input value={logChannelId} onChange={(event) => setLogChannelId(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          靜音身分組 ID
          <Input value={muteRoleId} onChange={(event) => setMuteRoleId(event.target.value)} />
        </label>
      </div>
      <label className="grid gap-2 text-sm font-medium">
        預設禁言秒數
        <Input
          type="number"
          min={60}
          max={2_419_200}
          value={defaultTimeoutSeconds}
          onChange={(event) => setDefaultTimeoutSeconds(event.target.value)}
        />
      </label>
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
