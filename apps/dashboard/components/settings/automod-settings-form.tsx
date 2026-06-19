"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  autoModPunishmentLabels,
  autoModPunishments,
  autoModTriggerLabels,
  type AutoModRuleInput,
  type AutoModTriggerKey
} from "@guildforge/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AutoModSettingsFormProps = {
  guildId: string;
  rules: AutoModRuleInput[];
};

function splitIds(value: string) {
  return value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinIds(values: string[]) {
  return values.join(", ");
}

export function AutoModSettingsForm({ guildId, rules }: AutoModSettingsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localRules, setLocalRules] = useState(rules);
  const [message, setMessage] = useState<string | null>(null);

  function updateRule(trigger: AutoModTriggerKey, patch: Partial<AutoModRuleInput>) {
    setLocalRules((current) =>
      current.map((rule) => (rule.trigger === trigger ? { ...rule, ...patch } : rule))
    );
  }

  function updatePattern(
    trigger: AutoModTriggerKey,
    patch: Partial<AutoModRuleInput["pattern"]>
  ) {
    setLocalRules((current) =>
      current.map((rule) =>
        rule.trigger === trigger ? { ...rule, pattern: { ...rule.pattern, ...patch } } : rule
      )
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch(`/api/guilds/${guildId}/automod`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        rules: localRules
      })
    });

    if (!response.ok) {
      setMessage("無法儲存自動管理設定。");
      return;
    }

    setMessage("已儲存。");
    startTransition(() => router.refresh());
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      {localRules.map((rule) => (
        <div key={rule.trigger} className="grid gap-3 rounded-md border border-border p-3">
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={rule.enabled}
                onChange={(event) => updateRule(rule.trigger, { enabled: event.target.checked })}
              />
              {autoModTriggerLabels[rule.trigger]}
            </label>
            <select
              className="h-9 rounded-md border border-border bg-white px-2 text-sm"
              value={rule.punishment}
              onChange={(event) =>
                updateRule(rule.trigger, {
                  punishment: event.target.value as AutoModRuleInput["punishment"]
                })
              }
            >
              {autoModPunishments.map((punishment) => (
                <option key={punishment} value={punishment}>
                  {autoModPunishmentLabels[punishment]}
                </option>
              ))}
            </select>
          </div>

          {rule.trigger === "BANNED_WORD" ? (
            <label className="grid gap-2 text-sm font-medium">
              禁用詞
              <Input
                value={rule.pattern.words.join(", ")}
                onChange={(event) =>
                  updatePattern(rule.trigger, {
                    words: event.target.value
                      .split(",")
                      .map((word) => word.trim())
                      .filter(Boolean)
                  })
                }
              />
            </label>
          ) : null}

          {rule.trigger === "SPAM" ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                訊息數量上限
                <Input
                  type="number"
                  value={rule.pattern.maxMessages}
                  onChange={(event) =>
                    updatePattern(rule.trigger, { maxMessages: Number(event.target.value) })
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                偵測時間範圍（秒）
                <Input
                  type="number"
                  value={rule.pattern.windowSeconds}
                  onChange={(event) =>
                    updatePattern(rule.trigger, { windowSeconds: Number(event.target.value) })
                  }
                />
              </label>
            </div>
          ) : null}

          {rule.trigger === "MASS_MENTION" ? (
            <label className="grid gap-2 text-sm font-medium">
              提及數量上限
              <Input
                type="number"
                value={rule.pattern.maxMentions}
                onChange={(event) =>
                  updatePattern(rule.trigger, { maxMentions: Number(event.target.value) })
                }
              />
            </label>
          ) : null}

          {rule.trigger === "REPEATED_MESSAGE" ? (
            <label className="grid gap-2 text-sm font-medium">
              重複訊息次數上限
              <Input
                type="number"
                value={rule.pattern.repeatedLimit}
                onChange={(event) =>
                  updatePattern(rule.trigger, { repeatedLimit: Number(event.target.value) })
                }
              />
            </label>
          ) : null}

          {rule.trigger === "CAPS_LOCK" ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                最少字母數
                <Input
                  type="number"
                  value={rule.pattern.capsMinLength}
                  onChange={(event) =>
                    updatePattern(rule.trigger, { capsMinLength: Number(event.target.value) })
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                大寫字母比例
                <Input
                  type="number"
                  step="0.05"
                  min="0.5"
                  max="1"
                  value={rule.pattern.capsPercentage}
                  onChange={(event) =>
                    updatePattern(rule.trigger, { capsPercentage: Number(event.target.value) })
                  }
                />
              </label>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-medium">
              禁言秒數
              <Input
                type="number"
                value={rule.punishmentDurationSeconds ?? ""}
                onChange={(event) =>
                  updateRule(rule.trigger, {
                    punishmentDurationSeconds: event.target.value ? Number(event.target.value) : null
                  })
                }
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              忽略的頻道
              <Input
                value={joinIds(rule.ignoredChannelIds)}
                onChange={(event) =>
                  updateRule(rule.trigger, { ignoredChannelIds: splitIds(event.target.value) })
                }
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              忽略的身分組
              <Input
                value={joinIds(rule.ignoredRoleIds)}
                onChange={(event) =>
                  updateRule(rule.trigger, { ignoredRoleIds: splitIds(event.target.value) })
                }
              />
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
