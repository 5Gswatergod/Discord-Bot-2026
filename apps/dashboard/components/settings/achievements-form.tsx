"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  achievementTriggerLabels,
  achievementTriggers,
  type AchievementInput,
  type AchievementSettings
} from "@guildforge/shared";

import {
  DiscordChannelSelect,
  DiscordRoleSelect
} from "@/components/discord-resource-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function blankAchievement(): AchievementInput {
  return {
    name: "新成就",
    description: "",
    icon: "🏆",
    trigger: "MESSAGE_COUNT",
    threshold: 100,
    rewardRoleId: null,
    enabled: true
  };
}

export function AchievementsForm({
  guildId,
  settings
}: {
  guildId: string;
  settings: AchievementSettings;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = useState(settings);
  const [message, setMessage] = useState<string | null>(null);

  function update(index: number, data: Partial<AchievementInput>) {
    setLocal((current) => ({
      ...current,
      achievements: current.achievements.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...data } : item
      )
    }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch(`/api/guilds/${guildId}/achievements`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(local)
    });

    setMessage(response.ok ? "已儲存成就設定。" : "無法儲存成就設定。");
    if (response.ok) startTransition(() => router.refresh());
  }

  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          解鎖公告頻道
          <DiscordChannelSelect
            value={local.announcementChannelId ?? ""}
            onValueChange={(announcementChannelId) =>
              setLocal((current) => ({
                ...current,
                announcementChannelId: announcementChannelId || null
              }))
            }
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          公告訊息
          <Input
            value={local.announcementMessage}
            onChange={(event) =>
              setLocal((current) => ({
                ...current,
                announcementMessage: event.target.value
              }))
            }
          />
        </label>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">成就規則</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setLocal((current) => ({
              ...current,
              achievements: [...current.achievements, blankAchievement()]
            }))
          }
        >
          <Plus size={14} aria-hidden="true" />
          新增
        </Button>
      </div>
      {local.achievements.map((achievement, index) => (
        <div key={achievement.id ?? index} className="grid gap-3 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium">
              {achievement.icon || "🏆"} {achievement.name}
            </p>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="移除成就"
              onClick={() =>
                setLocal((current) => ({
                  ...current,
                  achievements: current.achievements.filter((_, itemIndex) => itemIndex !== index)
                }))
              }
            >
              <Trash2 size={16} aria-hidden="true" />
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-[100px_1fr_180px_140px]">
            <label className="grid gap-2 text-sm font-medium">
              圖示
              <Input
                value={achievement.icon ?? ""}
                onChange={(event) => update(index, { icon: event.target.value || null })}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              名稱
              <Input
                value={achievement.name}
                onChange={(event) => update(index, { name: event.target.value })}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              條件
              <select
                className="h-10 rounded-md border border-border bg-input px-3 text-sm"
                value={achievement.trigger}
                onChange={(event) =>
                  update(index, {
                    trigger: event.target.value as AchievementInput["trigger"]
                  })
                }
              >
                {achievementTriggers.map((trigger) => (
                  <option key={trigger} value={trigger}>
                    {achievementTriggerLabels[trigger]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              門檻
              <Input
                type="number"
                min={1}
                value={achievement.threshold}
                onChange={(event) => update(index, { threshold: Number(event.target.value) })}
              />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            說明
            <Textarea
              value={achievement.description ?? ""}
              onChange={(event) => update(index, { description: event.target.value || null })}
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              獎勵身分組
              <DiscordRoleSelect
                value={achievement.rewardRoleId ?? ""}
                assignableOnly
                onValueChange={(rewardRoleId) =>
                  update(index, { rewardRoleId: rewardRoleId || null })
                }
              />
            </label>
            <label className="flex items-center gap-2 self-end pb-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={achievement.enabled}
                onChange={(event) => update(index, { enabled: event.target.checked })}
              />
              啟用此成就
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
