"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  defaultSocialAlertTemplates,
  socialAlertTypeLabels,
  socialAlertTypes,
  type SocialAlertInput
} from "@guildforge/shared";

import { DiscordChannelSelect } from "@/components/discord-resource-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type SocialAlertsFormProps = {
  guildId: string;
  alerts: SocialAlertInput[];
};

function blankAlert(): SocialAlertInput {
  return {
    type: "RSS",
    sourceId: "https://example.com/feed.xml",
    sourceUrl: "https://example.com/feed.xml",
    channelId: "",
    messageTemplate: defaultSocialAlertTemplates.RSS,
    intervalSeconds: 300,
    enabled: true
  };
}

export function SocialAlertsForm({ guildId, alerts }: SocialAlertsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localAlerts, setLocalAlerts] = useState(alerts);
  const [message, setMessage] = useState<string | null>(null);

  function updateAlert(index: number, patch: Partial<SocialAlertInput>) {
    setLocalAlerts((current) =>
      current.map((alert, itemIndex) => (itemIndex === index ? { ...alert, ...patch } : alert))
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch(`/api/guilds/${guildId}/social-alerts`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ alerts: localAlerts })
    });

    if (!response.ok) {
      setMessage("無法儲存社群通知。");
      return;
    }

    setMessage("已儲存。");
    startTransition(() => router.refresh());
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">通知來源</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setLocalAlerts((current) => [...current, blankAlert()])}
        >
          <Plus size={14} aria-hidden="true" />
          新增
        </Button>
      </div>
      {localAlerts.map((alert, index) => (
        <div key={alert.id ?? index} className="grid gap-3 rounded-md border border-border p-3">
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={alert.enabled}
                onChange={(event) => updateAlert(index, { enabled: event.target.checked })}
              />
              已啟用
            </label>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() =>
                setLocalAlerts((current) => current.filter((_, itemIndex) => itemIndex !== index))
              }
            >
              <Trash2 size={16} aria-hidden="true" />
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-[160px_1fr_1fr]">
            <label className="grid gap-2 text-sm font-medium">
              類型
              <select
                className="h-10 rounded-md border border-border bg-input px-3 text-sm text-foreground"
                value={alert.type}
                onChange={(event) => {
                  const type = event.target.value as SocialAlertInput["type"];
                  updateAlert(index, {
                    type,
                    messageTemplate: defaultSocialAlertTemplates[type]
                  });
                }}
              >
                {socialAlertTypes.map((type) => (
                  <option key={type} value={type}>
                    {socialAlertTypeLabels[type]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              來源 ID
              <Input
                value={alert.sourceId}
                onChange={(event) => updateAlert(index, { sourceId: event.target.value })}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              通知頻道
              <DiscordChannelSelect
                value={alert.channelId}
                allowEmpty={false}
                onValueChange={(channelId) => updateAlert(index, { channelId })}
              />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_150px]">
            <label className="grid gap-2 text-sm font-medium">
              來源網址
              <Input
                value={alert.sourceUrl}
                onChange={(event) => updateAlert(index, { sourceUrl: event.target.value })}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              檢查間隔（秒）
              <Input
                type="number"
                min={60}
                max={86400}
                value={alert.intervalSeconds}
                onChange={(event) =>
                  updateAlert(index, { intervalSeconds: Number(event.target.value) })
                }
              />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            通知訊息範本
            <Textarea
              value={alert.messageTemplate}
              onChange={(event) => updateAlert(index, { messageTemplate: event.target.value })}
            />
          </label>
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
