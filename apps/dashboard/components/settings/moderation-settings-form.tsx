"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { ModerationSettings } from "@guildforge/shared";

import {
  DiscordChannelSelect,
  DiscordRoleMultiSelect,
  DiscordRoleSelect
} from "@/components/discord-resource-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ModerationSettingsFormProps = {
  guildId: string;
  settings: ModerationSettings;
};

export function ModerationSettingsForm({ guildId, settings }: ModerationSettingsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [moderatorRoleIds, setModeratorRoleIds] = useState(settings.moderatorRoleIds);
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
        moderatorRoleIds,
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
      <div className="grid gap-2 text-sm font-medium">
        <p>管理員身分組</p>
        <DiscordRoleMultiSelect
          ariaLabel="管理員身分組"
          values={moderatorRoleIds}
          onValuesChange={setModeratorRoleIds}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          紀錄頻道
          <DiscordChannelSelect value={logChannelId} onValueChange={setLogChannelId} />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          靜音身分組
          <DiscordRoleSelect
            value={muteRoleId}
            onValueChange={setMuteRoleId}
            assignableOnly
          />
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
