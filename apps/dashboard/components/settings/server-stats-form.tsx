"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  defaultServerStatTemplates,
  serverStatTypeLabels,
  serverStatTypes,
  type ServerStatChannelInput
} from "@guildforge/shared";

import { DiscordCategorySelect } from "@/components/discord-resource-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function blankStat(usedTypes: Set<ServerStatChannelInput["type"]>): ServerStatChannelInput | null {
  const type = serverStatTypes.find((item) => !usedTypes.has(item));

  return type
    ? {
        type,
        template: defaultServerStatTemplates[type],
        categoryId: null,
        enabled: true
      }
    : null;
}

export function ServerStatsForm({
  guildId,
  channels
}: {
  guildId: string;
  channels: ServerStatChannelInput[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localChannels, setLocalChannels] = useState(channels);
  const [message, setMessage] = useState<string | null>(null);

  function update(index: number, data: Partial<ServerStatChannelInput>) {
    setLocalChannels((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...data } : item))
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch(`/api/guilds/${guildId}/server-stats`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channels: localChannels })
    });

    setMessage(response.ok ? "已儲存，統計頻道會自動建立或更新。" : "無法儲存統計頻道。");
    if (response.ok) startTransition(() => router.refresh());
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">統計頻道</p>
          <p className="mt-1 text-xs text-muted-foreground">
            頻道會禁止成員連線，僅用名稱顯示統計。
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={localChannels.length >= serverStatTypes.length}
          onClick={() => {
            const next = blankStat(new Set(localChannels.map((item) => item.type)));
            if (next) setLocalChannels((current) => [...current, next]);
          }}
        >
          <Plus size={14} aria-hidden="true" />
          新增
        </Button>
      </div>
      {localChannels.map((item, index) => (
        <div
          key={item.id ?? item.type}
          className="grid gap-3 rounded-md border border-border p-4 md:grid-cols-[180px_1fr_1fr_auto]"
        >
          <label className="grid gap-2 text-sm font-medium">
            統計類型
            <select
              className="h-10 rounded-md border border-border bg-input px-3 text-sm"
              value={item.type}
              onChange={(event) => {
                const type = event.target.value as ServerStatChannelInput["type"];
                update(index, { type, template: defaultServerStatTemplates[type] });
              }}
            >
              {serverStatTypes.map((type) => (
                <option
                  key={type}
                  value={type}
                  disabled={localChannels.some(
                    (channel, channelIndex) => channelIndex !== index && channel.type === type
                  )}
                >
                  {serverStatTypeLabels[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            名稱範本
            <Input
              value={item.template}
              onChange={(event) => update(index, { template: event.target.value })}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Discord 分類
            <DiscordCategorySelect
              value={item.categoryId ?? ""}
              onValueChange={(categoryId) => update(index, { categoryId: categoryId || null })}
            />
          </label>
          <div className="flex items-end gap-2 pb-1">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={item.enabled}
                onChange={(event) => update(index, { enabled: event.target.checked })}
              />
              啟用
            </label>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="移除統計頻道"
              onClick={() =>
                setLocalChannels((current) =>
                  current.filter((_, itemIndex) => itemIndex !== index)
                )
              }
            >
              <Trash2 size={16} aria-hidden="true" />
            </Button>
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">名稱範本可使用 {"{count}"}。</p>
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
