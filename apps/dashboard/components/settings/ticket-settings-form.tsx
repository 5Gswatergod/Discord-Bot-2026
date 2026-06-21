"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { TicketSettings } from "@guildforge/shared";

import {
  DiscordCategorySelect,
  DiscordChannelSelect,
  DiscordRoleMultiSelect
} from "@/components/discord-resource-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function TicketSettingsForm({
  guildId,
  settings
}: {
  guildId: string;
  settings: TicketSettings;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = useState(settings);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch(`/api/guilds/${guildId}/tickets`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(local)
    });

    setMessage(response.ok ? "已儲存，客服面板會在一分鐘內自動同步。" : "無法儲存客服單設定。");

    if (response.ok) {
      startTransition(() => router.refresh());
    }
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          面板頻道
          <DiscordChannelSelect
            value={local.panelChannelId ?? ""}
            onValueChange={(panelChannelId) =>
              setLocal((current) => ({ ...current, panelChannelId: panelChannelId || null }))
            }
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          客服單分類
          <DiscordCategorySelect
            value={local.categoryId ?? ""}
            onValueChange={(categoryId) =>
              setLocal((current) => ({ ...current, categoryId: categoryId || null }))
            }
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          紀錄頻道
          <DiscordChannelSelect
            value={local.logChannelId ?? ""}
            onValueChange={(logChannelId) =>
              setLocal((current) => ({ ...current, logChannelId: logChannelId || null }))
            }
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          每位成員可同時開啟
          <Input
            type="number"
            min={1}
            max={5}
            value={local.maxOpenPerUser}
            onChange={(event) =>
              setLocal((current) => ({
                ...current,
                maxOpenPerUser: Number(event.target.value)
              }))
            }
          />
        </label>
      </div>
      <label className="grid gap-2 text-sm font-medium">
        客服身分組
        <DiscordRoleMultiSelect
          values={local.supportRoleIds}
          onValuesChange={(supportRoleIds) =>
            setLocal((current) => ({ ...current, supportRoleIds }))
          }
          ariaLabel="選擇客服身分組"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        面板標題
        <Input
          value={local.panelTitle}
          onChange={(event) =>
            setLocal((current) => ({ ...current, panelTitle: event.target.value }))
          }
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        面板說明
        <Textarea
          value={local.panelDescription}
          onChange={(event) =>
            setLocal((current) => ({ ...current, panelDescription: event.target.value }))
          }
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        開單後歡迎訊息
        <Textarea
          value={local.ticketWelcomeMessage}
          onChange={(event) =>
            setLocal((current) => ({ ...current, ticketWelcomeMessage: event.target.value }))
          }
        />
        <span className="text-xs font-normal text-muted-foreground">
          可使用：{"{user}"}、{"{username}"}、{"{server}"}
        </span>
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          <Save size={16} aria-hidden="true" />
          儲存客服單設定
        </Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </form>
  );
}
