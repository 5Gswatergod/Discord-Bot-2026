"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { LevelingSettings, LevelingUpdate } from "@guildforge/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type LevelingSettingsFormProps = {
  guildId: string;
  settings: LevelingSettings;
  rewards: LevelingUpdate["rewards"];
};

function splitIds(value: string) {
  return value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function LevelingSettingsForm({ guildId, settings, rewards }: LevelingSettingsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [xpPerMessage, setXpPerMessage] = useState(String(settings.xpPerMessage));
  const [cooldownSeconds, setCooldownSeconds] = useState(String(settings.cooldownSeconds));
  const [formula, setFormula] = useState(settings.formula);
  const [baseXp, setBaseXp] = useState(String(settings.baseXp));
  const [levelUpChannelId, setLevelUpChannelId] = useState(settings.levelUpChannelId ?? "");
  const [levelUpMessage, setLevelUpMessage] = useState(settings.levelUpMessage);
  const [ignoredChannelIds, setIgnoredChannelIds] = useState(settings.ignoredChannelIds.join(", "));
  const [localRewards, setLocalRewards] = useState(rewards);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch(`/api/guilds/${guildId}/leveling`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        xpPerMessage: Number(xpPerMessage),
        cooldownSeconds: Number(cooldownSeconds),
        formula,
        baseXp: Number(baseXp),
        levelUpChannelId: levelUpChannelId || null,
        levelUpMessage,
        ignoredChannelIds: splitIds(ignoredChannelIds),
        rewards: localRewards
      })
    });

    if (!response.ok) {
      setMessage("Failed to save leveling settings.");
      return;
    }

    setMessage("Saved.");
    startTransition(() => router.refresh());
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          XP per message
          <Input
            type="number"
            min={1}
            max={500}
            value={xpPerMessage}
            onChange={(event) => setXpPerMessage(event.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Cooldown seconds
          <Input
            type="number"
            min={5}
            max={86_400}
            value={cooldownSeconds}
            onChange={(event) => setCooldownSeconds(event.target.value)}
          />
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Formula
          <select
            className="h-10 rounded-md border border-border bg-white px-3 text-sm"
            value={formula}
            onChange={(event) => setFormula(event.target.value as typeof formula)}
          >
            <option value="QUADRATIC">Quadratic</option>
            <option value="LINEAR">Linear</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Base XP
          <Input
            type="number"
            min={25}
            max={10_000}
            value={baseXp}
            onChange={(event) => setBaseXp(event.target.value)}
          />
        </label>
      </div>
      <label className="grid gap-2 text-sm font-medium">
        Level up channel ID
        <Input value={levelUpChannelId} onChange={(event) => setLevelUpChannelId(event.target.value)} />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Level up message
        <Textarea value={levelUpMessage} onChange={(event) => setLevelUpMessage(event.target.value)} />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Ignored channel IDs
        <Input value={ignoredChannelIds} onChange={(event) => setIgnoredChannelIds(event.target.value)} />
      </label>
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Role rewards</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setLocalRewards((current) => [...current, { level: 1, roleId: "", stackable: true }])}
          >
            <Plus size={14} aria-hidden="true" />
            Add
          </Button>
        </div>
        {localRewards.map((reward, index) => (
          <div key={`${reward.level}-${reward.roleId}-${index}`} className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-[90px_1fr_auto_auto] md:items-end">
            <label className="grid gap-2 text-sm font-medium">
              Level
              <Input
                type="number"
                min={1}
                value={reward.level}
                onChange={(event) =>
                  setLocalRewards((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, level: Number(event.target.value) } : item
                    )
                  )
                }
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Role ID
              <Input
                value={reward.roleId}
                onChange={(event) =>
                  setLocalRewards((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, roleId: event.target.value } : item
                    )
                  )
                }
              />
            </label>
            <label className="flex items-center gap-2 pb-2 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={reward.stackable}
                onChange={(event) =>
                  setLocalRewards((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, stackable: event.target.checked } : item
                    )
                  )
                }
              />
              Stack
            </label>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setLocalRewards((current) => current.filter((_, itemIndex) => itemIndex !== index))}
            >
              <Trash2 size={16} aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          <Save size={16} aria-hidden="true" />
          Save
        </Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </form>
  );
}
