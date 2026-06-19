"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import type { WelcomeSettings } from "@guildforge/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type WelcomeSettingsFormProps = {
  guildId: string;
  guildName: string;
  memberCount: number | null;
  settings: WelcomeSettings;
};

function renderPreview(template: string, guildName: string, memberCount: number | null) {
  return template
    .replaceAll("{user}", "@新成員")
    .replaceAll("{username}", "新成員")
    .replaceAll("{server}", guildName)
    .replaceAll("{memberCount}", String(memberCount ?? 0));
}

export function WelcomeSettingsForm({
  guildId,
  guildName,
  memberCount,
  settings
}: WelcomeSettingsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [welcomeChannelId, setWelcomeChannelId] = useState(settings.welcomeChannelId ?? "");
  const [welcomeMessage, setWelcomeMessage] = useState(settings.welcomeMessage);
  const [goodbyeChannelId, setGoodbyeChannelId] = useState(settings.goodbyeChannelId ?? "");
  const [goodbyeMessage, setGoodbyeMessage] = useState(settings.goodbyeMessage);
  const [autoRoleId, setAutoRoleId] = useState(settings.autoRoleId ?? "");
  const [useEmbed, setUseEmbed] = useState(settings.useEmbed);
  const [embedColor, setEmbedColor] = useState(settings.embedColor);
  const [message, setMessage] = useState<string | null>(null);

  const preview = useMemo(
    () => renderPreview(welcomeMessage, guildName, memberCount),
    [guildName, memberCount, welcomeMessage]
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch(`/api/guilds/${guildId}/welcome`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        enabled,
        welcomeChannelId: welcomeChannelId || null,
        welcomeMessage,
        goodbyeChannelId: goodbyeChannelId || null,
        goodbyeMessage,
        autoRoleId: autoRoleId || null,
        useEmbed,
        embedColor
      })
    });

    if (!response.ok) {
      setMessage("無法儲存歡迎訊息設定。");
      return;
    }

    setMessage("已儲存。");
    startTransition(() => router.refresh());
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm font-medium">
        啟用歡迎訊息模組
        <input
          type="checkbox"
          className="h-4 w-4 accent-primary"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          歡迎訊息頻道 ID
          <Input value={welcomeChannelId} onChange={(event) => setWelcomeChannelId(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          離開訊息頻道 ID
          <Input value={goodbyeChannelId} onChange={(event) => setGoodbyeChannelId(event.target.value)} />
        </label>
      </div>
      <label className="grid gap-2 text-sm font-medium">
        歡迎訊息
        <Textarea value={welcomeMessage} onChange={(event) => setWelcomeMessage(event.target.value)} />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        離開訊息
        <Textarea value={goodbyeMessage} onChange={(event) => setGoodbyeMessage(event.target.value)} />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          自動指派身分組 ID
          <Input value={autoRoleId} onChange={(event) => setAutoRoleId(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          嵌入訊息顏色
          <Input type="color" value={embedColor} onChange={(event) => setEmbedColor(event.target.value)} />
        </label>
      </div>
      <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm font-medium">
        使用嵌入訊息格式
        <input
          type="checkbox"
          className="h-4 w-4 accent-primary"
          checked={useEmbed}
          onChange={(event) => setUseEmbed(event.target.checked)}
        />
      </label>
      <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        {preview}
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
