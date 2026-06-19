"use client";

import { Plus, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { GiveawayInput } from "@guildforge/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type GiveawaysFormProps = {
  guildId: string;
  giveaways: DashboardGiveawayInput[];
};

export type DashboardGiveawayInput = Omit<GiveawayInput, "endsAt"> & {
  endsAt: string;
};

function toDatetimeLocal(value: string) {
  const date = new Date(value);

  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function blankGiveaway(): DashboardGiveawayInput {
  return {
    channelId: "",
    prize: "獎品",
    winnerCount: 1,
    requiredRoleId: null,
    endsAt: new Date(Date.now() + 3_600_000).toISOString()
  };
}

export function GiveawaysForm({ guildId, giveaways }: GiveawaysFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localGiveaways, setLocalGiveaways] = useState(giveaways);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch(`/api/guilds/${guildId}/giveaways`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ giveaways: localGiveaways })
    });

    if (!response.ok) {
      setMessage("無法儲存抽獎設定。");
      return;
    }

    setMessage("已儲存。請使用「/抽獎 建立」立即發佈。");
    startTransition(() => router.refresh());
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">抽獎</p>
        <Button type="button" size="sm" variant="outline" onClick={() => setLocalGiveaways((current) => [...current, blankGiveaway()])}>
          <Plus size={14} aria-hidden="true" />
          新增
        </Button>
      </div>
      {localGiveaways.map((giveaway, index) => (
        <div key={giveaway.id ?? index} className="grid gap-3 rounded-md border border-border p-3">
          <p className="text-sm font-medium">{giveaway.id ?? "新抽獎"}</p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              獎品
              <Input value={giveaway.prize} onChange={(event) => setLocalGiveaways((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, prize: event.target.value } : item))} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              頻道 ID
              <Input value={giveaway.channelId} onChange={(event) => setLocalGiveaways((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, channelId: event.target.value } : item))} />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-medium">
              得獎人數
              <Input type="number" min={1} max={25} value={giveaway.winnerCount} onChange={(event) => setLocalGiveaways((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, winnerCount: Number(event.target.value) } : item))} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              必要身分組 ID
              <Input value={giveaway.requiredRoleId ?? ""} onChange={(event) => setLocalGiveaways((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, requiredRoleId: event.target.value || null } : item))} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              結束時間
              <Input type="datetime-local" value={toDatetimeLocal(giveaway.endsAt)} onChange={(event) => setLocalGiveaways((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, endsAt: new Date(event.target.value).toISOString() } : item))} />
            </label>
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
