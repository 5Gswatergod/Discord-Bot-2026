"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { EconomySettings } from "@guildforge/shared";

import {
  DiscordChannelMultiSelect,
  DiscordRoleMultiSelect
} from "@/components/discord-resource-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type EconomySettingsFormProps = {
  guildId: string;
  settings: EconomySettings;
};

export function EconomySettingsForm({ guildId, settings }: EconomySettingsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(settings);
  const [ignoredChannels, setIgnoredChannels] = useState(settings.messageIgnoredChannelIds);
  const [ignoredRoles, setIgnoredRoles] = useState(settings.messageIgnoredRoleIds);
  const [message, setMessage] = useState<string | null>(null);

  function update<K extends keyof EconomySettings>(key: K, value: EconomySettings[K]) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch(`/api/guilds/${guildId}/economy`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...form,
        messageIgnoredChannelIds: ignoredChannels,
        messageIgnoredRoleIds: ignoredRoles
      })
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(data?.error ?? "無法儲存經濟系統設定。");
      return;
    }

    setMessage("已儲存。");
    startTransition(() => router.refresh());
  }

  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          貨幣名稱
          <Input
            value={form.currencyName}
            onChange={(event) => update("currencyName", event.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          貨幣符號
          <Input
            value={form.currencySymbol}
            onChange={(event) => update("currencySymbol", event.target.value)}
          />
        </label>
      </div>

      <fieldset className="grid gap-4 rounded-md border border-border p-4">
        <label className="flex items-center justify-between gap-3 text-sm font-medium">
          啟用聊天獎勵
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={form.messageRewardsEnabled}
            onChange={(event) => update("messageRewardsEnabled", event.target.checked)}
          />
        </label>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-medium">
            最小獎勵
            <Input
              type="number"
              min={0}
              value={form.messageRewardMin}
              onChange={(event) => update("messageRewardMin", Number(event.target.value))}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            最大獎勵
            <Input
              type="number"
              min={0}
              value={form.messageRewardMax}
              onChange={(event) => update("messageRewardMax", Number(event.target.value))}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            冷卻秒數
            <Input
              type="number"
              min={5}
              value={form.messageRewardCooldownSeconds}
              onChange={(event) =>
                update("messageRewardCooldownSeconds", Number(event.target.value))
              }
            />
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2 text-sm font-medium">
            <p>忽略的頻道</p>
            <DiscordChannelMultiSelect
              ariaLabel="聊天獎勵忽略的頻道"
              values={ignoredChannels}
              onValuesChange={setIgnoredChannels}
            />
          </div>
          <div className="grid gap-2 text-sm font-medium">
            <p>忽略的身分組</p>
            <DiscordRoleMultiSelect
              ariaLabel="聊天獎勵忽略的身分組"
              values={ignoredRoles}
              onValuesChange={setIgnoredRoles}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 rounded-md border border-border p-4">
        <label className="flex items-center justify-between gap-3 text-sm font-medium">
          啟用每日獎勵
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={form.dailyRewardsEnabled}
            onChange={(event) => update("dailyRewardsEnabled", event.target.checked)}
          />
        </label>
        <div className="grid gap-4 md:grid-cols-4">
          <label className="grid gap-2 text-sm font-medium">
            基礎獎勵
            <Input
              type="number"
              min={0}
              value={form.dailyBaseReward}
              onChange={(event) => update("dailyBaseReward", Number(event.target.value))}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            每日連續加成
            <Input
              type="number"
              min={0}
              value={form.dailyStreakBonus}
              onChange={(event) => update("dailyStreakBonus", Number(event.target.value))}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            加成天數上限
            <Input
              type="number"
              min={1}
              value={form.dailyStreakCap}
              onChange={(event) => update("dailyStreakCap", Number(event.target.value))}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            伺服器時區
            <Input
              value={form.timeZone}
              onChange={(event) => update("timeZone", event.target.value)}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 rounded-md border border-border p-4">
        <label className="flex items-center justify-between gap-3 text-sm font-medium">
          啟用成員轉帳
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={form.transfersEnabled}
            onChange={(event) => update("transfersEnabled", event.target.checked)}
          />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            最低轉帳金額
            <Input
              type="number"
              min={1}
              value={form.minimumTransfer}
              onChange={(event) => update("minimumTransfer", Number(event.target.value))}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            手續費百分比
            <Input
              type="number"
              min={0}
              max={25}
              step="0.1"
              value={form.transferFeePercent}
              onChange={(event) => update("transferFeePercent", Number(event.target.value))}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 rounded-md border border-border p-4">
        <label className="flex items-center justify-between gap-3 text-sm font-medium">
          啟用升級貨幣獎勵
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={form.levelRewardsEnabled}
            onChange={(event) => update("levelRewardsEnabled", event.target.checked)}
          />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            升級基礎獎勵
            <Input
              type="number"
              min={0}
              value={form.levelRewardBase}
              onChange={(event) => update("levelRewardBase", Number(event.target.value))}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            每級倍率
            <Input
              type="number"
              min={0}
              value={form.levelRewardMultiplier}
              onChange={(event) => update("levelRewardMultiplier", Number(event.target.value))}
            />
          </label>
        </div>
      </fieldset>

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
