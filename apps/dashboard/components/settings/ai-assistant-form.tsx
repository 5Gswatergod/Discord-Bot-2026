"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { AiAssistantSettings } from "@guildforge/shared";

import { DiscordChannelMultiSelect } from "@/components/discord-resource-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function AiAssistantForm({
  guildId,
  settings,
  requestCount,
  failedCount
}: {
  guildId: string;
  settings: AiAssistantSettings;
  requestCount: number;
  failedCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = useState(settings);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch(`/api/guilds/${guildId}/ai-assistant`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(local)
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;

    setMessage(response.ok ? "已儲存 AI 助理設定。" : (body?.error ?? "無法儲存 AI 助理設定。"));
    if (response.ok) startTransition(() => router.refresh());
  }

  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      <div className="grid gap-3 rounded-lg border border-border p-4 text-sm md:grid-cols-2">
        <p>
          最近 30 天成功請求：<strong>{requestCount}</strong>
        </p>
        <p>
          最近 30 天失敗請求：<strong>{failedCount}</strong>
        </p>
      </div>
      <p className="rounded-md border border-amber-500/30 bg-amber-400/10 p-3 text-sm text-amber-800 dark:text-amber-200">
        AI 回覆會將設定數量的近期頻道訊息傳送到你配置的 AI 供應商。請只選擇成員已知情且適合傳送的頻道。
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          AI 人物名稱
          <Input
            value={local.personaName}
            onChange={(event) =>
              setLocal((current) => ({ ...current, personaName: event.target.value }))
            }
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          每日伺服器請求上限
          <Input
            type="number"
            min={1}
            max={1000}
            value={local.dailyRequestLimit}
            onChange={(event) =>
              setLocal((current) => ({
                ...current,
                dailyRequestLimit: Number(event.target.value)
              }))
            }
          />
        </label>
      </div>
      <label className="grid gap-2 text-sm font-medium">
        系統提示詞
        <Textarea
          rows={6}
          value={local.systemPrompt}
          onChange={(event) =>
            setLocal((current) => ({ ...current, systemPrompt: event.target.value }))
          }
        />
      </label>
      <div className="grid gap-2 text-sm font-medium">
        AI 可回覆的頻道
        <DiscordChannelMultiSelect
          ariaLabel="選擇 AI 助理頻道"
          values={local.channelIds}
          onValuesChange={(channelIds) =>
            setLocal((current) => ({ ...current, channelIds }))
          }
        />
        <p className="text-xs font-normal text-muted-foreground">
          未選擇時允許所有文字頻道；建議限制在專用 AI 頻道。
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-medium">
          對話上下文訊息數
          <Input
            type="number"
            min={1}
            max={20}
            value={local.maxContextMessages}
            onChange={(event) =>
              setLocal((current) => ({
                ...current,
                maxContextMessages: Number(event.target.value)
              }))
            }
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Temperature
          <Input
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={local.temperature}
            onChange={(event) =>
              setLocal((current) => ({
                ...current,
                temperature: Number(event.target.value)
              }))
            }
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          回覆字數上限
          <Input
            type="number"
            min={100}
            max={4000}
            value={local.maxResponseCharacters}
            onChange={(event) =>
              setLocal((current) => ({
                ...current,
                maxResponseCharacters: Number(event.target.value)
              }))
            }
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={local.mentionOnly}
          onChange={(event) =>
            setLocal((current) => ({ ...current, mentionOnly: event.target.checked }))
          }
        />
        只有提及 Hydrava 或回覆 Hydrava 時才呼叫 AI
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
