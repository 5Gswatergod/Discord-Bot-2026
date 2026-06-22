"use client";

import { AlertTriangle, CheckCircle2, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  defaultSocialAlertTemplates,
  socialAlertNeedsBridge,
  socialAlertTypeLabels,
  socialAlertTypes,
  type SocialAlertInput
} from "@guildforge/shared";

import {
  DiscordChannelSelect,
  DiscordRoleSelect
} from "@/components/discord-resource-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type DashboardSocialAlertInput = SocialAlertInput & {
  consecutiveFailures: number;
  lastError: string | null;
  lastErrorAt: string | null;
  lastSuccessAt: string | null;
  nextCheckAt: string;
  sentCount: number;
};

type SocialAlertsFormProps = {
  guildId: string;
  alerts: DashboardSocialAlertInput[];
};

function blankAlert(): DashboardSocialAlertInput {
  return {
    type: "RSS",
    sourceId: "https://example.com/feed.xml",
    sourceUrl: "https://example.com/feed.xml",
    channelId: "",
    mentionRoleId: null,
    mentionEveryone: false,
    messageTemplate: defaultSocialAlertTemplates.RSS,
    intervalSeconds: 300,
    maxItemsPerCheck: 3,
    maxNotificationsPerHour: 12,
    enabled: true,
    consecutiveFailures: 0,
    lastError: null,
    lastErrorAt: null,
    lastSuccessAt: null,
    nextCheckAt: new Date().toISOString(),
    sentCount: 0
  };
}

export function SocialAlertsForm({ guildId, alerts }: SocialAlertsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localAlerts, setLocalAlerts] = useState(alerts);
  const [message, setMessage] = useState<string | null>(null);

  function updateAlert(index: number, patch: Partial<DashboardSocialAlertInput>) {
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
                    sourceUrl: "",
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
              來源 ID／帳號
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
          {socialAlertNeedsBridge(alert.type) ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-400/10 p-3 text-xs leading-5 text-amber-800 dark:text-amber-200">
              {socialAlertTypeLabels[alert.type]} 的公開讀取通常需要第三方 bridge。請提供會回傳
              RSS、Atom、JSON Feed 或項目陣列 JSON 的公開 URL。
            </div>
          ) : null}
          {alert.type === "REDDIT" ? (
            <div className="rounded-md border border-blue-500/30 bg-blue-500/10 p-3 text-xs leading-5 text-blue-800 dark:text-blue-200">
              Reddit 官方 Data API 需要伺服器設定 REDDIT_CLIENT_ID 與
              REDDIT_CLIENT_SECRET；若未設定，也可在下方填入公開 feed bridge URL。
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-[1fr_150px_150px_170px]">
            <label className="grid gap-2 text-sm font-medium">
              來源／Feed／Bridge URL
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
            <label className="grid gap-2 text-sm font-medium">
              每次最多傳送
              <Input
                type="number"
                min={1}
                max={5}
                value={alert.maxItemsPerCheck}
                onChange={(event) =>
                  updateAlert(index, { maxItemsPerCheck: Number(event.target.value) })
                }
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              每小時最多通知
              <Input
                type="number"
                min={1}
                max={60}
                value={alert.maxNotificationsPerHour}
                onChange={(event) =>
                  updateAlert(index, {
                    maxNotificationsPerHour: Number(event.target.value)
                  })
                }
              />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              提及身分組
              <DiscordRoleSelect
                value={alert.mentionRoleId ?? ""}
                disabled={alert.mentionEveryone}
                onValueChange={(mentionRoleId) =>
                  updateAlert(index, {
                    mentionRoleId: mentionRoleId || null,
                    mentionEveryone: false
                  })
                }
              />
            </label>
            <label className="flex items-center gap-2 self-end pb-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={alert.mentionEveryone}
                onChange={(event) =>
                  updateAlert(index, {
                    mentionEveryone: event.target.checked,
                    mentionRoleId: event.target.checked ? null : alert.mentionRoleId
                  })
                }
              />
              提及 @everyone
            </label>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            通知訊息範本
            <Textarea
              value={alert.messageTemplate}
              onChange={(event) => updateAlert(index, { messageTemplate: event.target.value })}
            />
            <span className="text-xs font-normal text-muted-foreground">
              支援 {"{mention}"}、{"{title}"}、{"{url}"}、{"{author}"}、{"{source}"}、
              {"{type}"}、{"{server}"}、{"{publishedAt}"}。
            </span>
          </label>
          <div
            className={
              alert.lastError
                ? "rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm"
                : "rounded-md border border-border bg-muted/30 p-3 text-sm"
            }
          >
            <div className="flex items-center gap-2 font-medium">
              {alert.lastError ? (
                <AlertTriangle className="text-red-500" size={16} />
              ) : (
                <CheckCircle2 className="text-primary" size={16} />
              )}
              {alert.lastError
                ? `連續失敗 ${alert.consecutiveFailures} 次`
                : alert.lastSuccessAt
                  ? "來源運作正常"
                  : "等待第一次檢查"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              下次檢查：{new Date(alert.nextCheckAt).toLocaleString("zh-TW")} · 已傳送{" "}
              {alert.sentCount} 則
            </p>
            {alert.lastError ? (
              <p className="mt-2 break-words text-xs text-red-700 dark:text-red-300">
                {alert.lastError}
                {alert.lastErrorAt
                  ? ` · ${new Date(alert.lastErrorAt).toLocaleString("zh-TW")}`
                  : ""}
              </p>
            ) : null}
          </div>
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
