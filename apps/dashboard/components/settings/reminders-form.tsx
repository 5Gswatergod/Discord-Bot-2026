"use client";

import { Plus, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { ReminderInput } from "@guildforge/shared";

import { DiscordChannelSelect } from "@/components/discord-resource-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type DashboardReminderInput = Omit<ReminderInput, "nextRunAt"> & {
  nextRunAt: string;
};

function blankReminder(): DashboardReminderInput {
  return {
    channelId: "",
    message: "Hydrava 提醒",
    nextRunAt: new Date(Date.now() + 3_600_000).toISOString(),
    intervalSeconds: null,
    enabled: true
  };
}

function toDatetimeLocal(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function RemindersForm({
  guildId,
  reminders
}: {
  guildId: string;
  reminders: DashboardReminderInput[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localReminders, setLocalReminders] = useState(reminders);
  const [message, setMessage] = useState<string | null>(null);

  function update(index: number, data: Partial<DashboardReminderInput>) {
    setLocalReminders((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...data } : item))
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch(`/api/guilds/${guildId}/reminders`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reminders: localReminders })
    });

    setMessage(response.ok ? "已儲存提醒。" : "無法儲存提醒。");

    if (response.ok) {
      startTransition(() => router.refresh());
    }
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">提醒排程</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setLocalReminders((current) => [...current, blankReminder()])}
        >
          <Plus size={14} aria-hidden="true" />
          新增
        </Button>
      </div>
      {localReminders.map((item, index) => (
        <div key={item.id ?? index} className="grid gap-3 rounded-md border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">{item.id ?? "新提醒"}</p>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={item.enabled}
                onChange={(event) => update(index, { enabled: event.target.checked })}
              />
              啟用
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              發送頻道
              <DiscordChannelSelect
                value={item.channelId}
                allowEmpty={false}
                onValueChange={(channelId) => update(index, { channelId })}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              下次發送時間
              <Input
                type="datetime-local"
                value={toDatetimeLocal(item.nextRunAt)}
                onChange={(event) =>
                  update(index, { nextRunAt: new Date(event.target.value).toISOString() })
                }
              />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            提醒內容
            <Textarea
              value={item.message}
              onChange={(event) => update(index, { message: event.target.value })}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium md:max-w-xs">
            循環間隔（分鐘）
            <Input
              type="number"
              min={0}
              value={item.intervalSeconds ? item.intervalSeconds / 60 : 0}
              onChange={(event) => {
                const minutes = Number(event.target.value);
                update(index, { intervalSeconds: minutes > 0 ? minutes * 60 : null });
              }}
            />
            <span className="text-xs font-normal text-muted-foreground">填 0 代表只發送一次。</span>
          </label>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          <Save size={16} aria-hidden="true" />
          儲存提醒
        </Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </form>
  );
}
