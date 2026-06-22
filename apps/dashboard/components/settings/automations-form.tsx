"use client";

import {
  ArrowDown,
  ArrowUp,
  FlaskConical,
  Plus,
  Save,
  Trash2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  automationActionLabels,
  automationActionTypes,
  automationTriggerLabels,
  automationTriggers,
  type AutomationAction,
  type AutomationActionTypeKey,
  type AutomationRuleInput
} from "@guildforge/shared";

import {
  DiscordChannelMultiSelect,
  DiscordChannelSelect,
  DiscordRoleMultiSelect,
  DiscordRoleSelect
} from "@/components/discord-resource-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const weekdayLabels = ["日", "一", "二", "三", "四", "五", "六"];

function blankAction(type: AutomationActionTypeKey): AutomationAction {
  if (type === "SEND_MESSAGE") {
    return { type, channelId: null, content: "您好 {user}！" };
  }

  if (type === "ADD_ROLE") {
    return { type, roleId: "" };
  }

  if (type === "TIMEOUT_MEMBER") {
    return { type, durationSeconds: 600, reason: null };
  }

  if (type === "KICK_MEMBER") {
    return { type, reason: null };
  }

  if (type === "BAN_MEMBER") {
    return { type, reason: null, deleteMessageSeconds: 0 };
  }

  return { type: "DELETE_MESSAGE" };
}

function blankRule(position: number): AutomationRuleInput {
  return {
    name: `自動化規則 ${position + 1}`,
    description: null,
    trigger: "MESSAGE_CREATE",
    triggerConfig: {
      emoji: null,
      roleId: null,
      roleChange: "ANY"
    },
    conditions: {
      channelIds: [],
      requiredRoleIds: [],
      excludedRoleIds: [],
      keywords: [],
      keywordMode: "ANY",
      activeDays: [],
      startTime: null,
      endTime: null,
      timeZone: "Asia/Taipei"
    },
    actions: [blankAction("SEND_MESSAGE")],
    position,
    enabled: true,
    stopProcessing: false,
    cooldownSeconds: 0
  };
}

export function AutomationsForm({
  guildId,
  rules
}: {
  guildId: string;
  rules: AutomationRuleInput[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localRules, setLocalRules] = useState(rules);
  const [message, setMessage] = useState<string | null>(null);
  const [testMessages, setTestMessages] = useState<Record<number, string>>({});

  function updateRule(index: number, patch: Partial<AutomationRuleInput>) {
    setLocalRules((current) =>
      current.map((rule, itemIndex) =>
        itemIndex === index ? { ...rule, ...patch } : rule
      )
    );
  }

  function updateAction(index: number, actionIndex: number, action: AutomationAction) {
    setLocalRules((current) =>
      current.map((rule, itemIndex) =>
        itemIndex === index
          ? {
              ...rule,
              actions: rule.actions.map((currentAction, currentIndex) =>
                currentIndex === actionIndex ? action : currentAction
              )
            }
          : rule
      )
    );
  }

  function moveRule(index: number, direction: -1 | 1) {
    setLocalRules((current) => {
      const target = index + direction;

      if (target < 0 || target >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((rule, position) => ({ ...rule, position }));
    });
  }

  async function saveRules(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch(`/api/guilds/${guildId}/automations`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: localRules.map((rule, position) => ({ ...rule, position }))
      })
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;

    setMessage(response.ok ? "自動化規則已儲存。" : body?.error ?? "無法儲存自動化規則。");

    if (response.ok) {
      startTransition(() => router.refresh());
    }
  }

  async function testRule(index: number) {
    const rule = localRules[index];
    setTestMessages((current) => ({ ...current, [index]: "測試中…" }));
    const response = await fetch(`/api/guilds/${guildId}/automations/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rule,
        sample: {
          content: rule.conditions.keywords[0] ?? "Hydrava automation test",
          channelId: rule.conditions.channelIds[0] ?? null,
          roleIds: rule.conditions.requiredRoleIds,
          occurredAt: new Date().toISOString()
        }
      })
    });
    const body = (await response.json().catch(() => null)) as
      | { matched?: boolean; failures?: string[]; error?: string }
      | null;
    const result = response.ok
      ? body?.matched
        ? "條件符合；正式事件會執行所有動作。"
        : `條件未符合：${body?.failures?.join("、") || "未知原因"}`
      : body?.error ?? "測試失敗。";

    setTestMessages((current) => ({ ...current, [index]: result }));
    if (response.ok) startTransition(() => router.refresh());
  }

  return (
    <form className="grid gap-5" onSubmit={saveRules}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">規則由上往下執行</p>
          <p className="mt-1 text-xs text-muted-foreground">
            啟用「符合後停止」可避免同一事件繼續執行後續規則。
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setLocalRules((current) => [...current, blankRule(current.length)])
          }
        >
          <Plus size={14} aria-hidden="true" />
          新增規則
        </Button>
      </div>

      {localRules.map((rule, index) => (
        <article key={rule.id ?? index} className="grid gap-5 rounded-xl border border-border p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
                #{index + 1}
              </span>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(event) => updateRule(index, { enabled: event.target.checked })}
                />
                啟用
              </label>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={index === 0}
                onClick={() => moveRule(index, -1)}
                aria-label="向上移動規則"
              >
                <ArrowUp size={16} />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={index === localRules.length - 1}
                onClick={() => moveRule(index, 1)}
                aria-label="向下移動規則"
              >
                <ArrowDown size={16} />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() =>
                  setLocalRules((current) =>
                    current.filter((_, itemIndex) => itemIndex !== index)
                  )
                }
                aria-label="刪除規則"
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_200px]">
            <label className="grid gap-2 text-sm font-medium">
              規則名稱
              <Input
                value={rule.name}
                onChange={(event) => updateRule(index, { name: event.target.value })}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              說明
              <Input
                value={rule.description ?? ""}
                onChange={(event) =>
                  updateRule(index, { description: event.target.value || null })
                }
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              觸發事件
              <select
                className="h-10 rounded-md border border-border bg-input px-3 text-sm"
                value={rule.trigger}
                onChange={(event) =>
                  updateRule(index, {
                    trigger: event.target.value as AutomationRuleInput["trigger"],
                    triggerConfig: {
                      emoji: null,
                      roleId: null,
                      roleChange: "ANY"
                    }
                  })
                }
              >
                {automationTriggers.map((trigger) => (
                  <option key={trigger} value={trigger}>
                    {automationTriggerLabels[trigger]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {rule.trigger === "REACTION_ADD" ? (
            <label className="grid max-w-sm gap-2 text-sm font-medium">
              指定 Emoji（留空代表任何反應）
              <Input
                value={rule.triggerConfig.emoji ?? ""}
                onChange={(event) =>
                  updateRule(index, {
                    triggerConfig: {
                      ...rule.triggerConfig,
                      emoji: event.target.value || null
                    }
                  })
                }
              />
            </label>
          ) : null}

          {rule.trigger === "MEMBER_ROLE_UPDATE" ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                指定身分組（留空代表任何身分組）
                <DiscordRoleSelect
                  value={rule.triggerConfig.roleId ?? ""}
                  onValueChange={(roleId) =>
                    updateRule(index, {
                      triggerConfig: {
                        ...rule.triggerConfig,
                        roleId: roleId || null
                      }
                    })
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                變更方式
                <select
                  className="h-10 rounded-md border border-border bg-input px-3 text-sm"
                  value={rule.triggerConfig.roleChange}
                  onChange={(event) =>
                    updateRule(index, {
                      triggerConfig: {
                        ...rule.triggerConfig,
                        roleChange: event.target.value as
                          AutomationRuleInput["triggerConfig"]["roleChange"]
                      }
                    })
                  }
                >
                  <option value="ANY">新增或移除</option>
                  <option value="ADDED">新增</option>
                  <option value="REMOVED">移除</option>
                </select>
              </label>
            </div>
          ) : null}

          <div className="grid gap-4 rounded-lg bg-muted/40 p-4">
            <p className="text-sm font-semibold">條件</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2 text-sm font-medium">
                <p>允許的頻道</p>
                <DiscordChannelMultiSelect
                  ariaLabel={`${rule.name} 允許的頻道`}
                  values={rule.conditions.channelIds}
                  onValuesChange={(channelIds) =>
                    updateRule(index, {
                      conditions: { ...rule.conditions, channelIds }
                    })
                  }
                />
              </div>
              <label className="grid gap-2 text-sm font-medium">
                關鍵字（以逗號分隔）
                <Input
                  value={rule.conditions.keywords.join(", ")}
                  onChange={(event) =>
                    updateRule(index, {
                      conditions: {
                        ...rule.conditions,
                        keywords: event.target.value
                          .split(",")
                          .map((value) => value.trim())
                          .filter(Boolean)
                      }
                    })
                  }
                />
              </label>
              <div className="grid gap-2 text-sm font-medium">
                <p>必要身分組</p>
                <DiscordRoleMultiSelect
                  ariaLabel={`${rule.name} 必要身分組`}
                  values={rule.conditions.requiredRoleIds}
                  onValuesChange={(requiredRoleIds) =>
                    updateRule(index, {
                      conditions: { ...rule.conditions, requiredRoleIds }
                    })
                  }
                />
              </div>
              <div className="grid gap-2 text-sm font-medium">
                <p>排除身分組</p>
                <DiscordRoleMultiSelect
                  ariaLabel={`${rule.name} 排除身分組`}
                  values={rule.conditions.excludedRoleIds}
                  onValuesChange={(excludedRoleIds) =>
                    updateRule(index, {
                      conditions: { ...rule.conditions, excludedRoleIds }
                    })
                  }
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-[160px_1fr_1fr_1.3fr]">
              <label className="grid gap-2 text-sm font-medium">
                關鍵字模式
                <select
                  className="h-10 rounded-md border border-border bg-input px-3 text-sm"
                  value={rule.conditions.keywordMode}
                  onChange={(event) =>
                    updateRule(index, {
                      conditions: {
                        ...rule.conditions,
                        keywordMode: event.target.value as "ANY" | "ALL"
                      }
                    })
                  }
                >
                  <option value="ANY">任一符合</option>
                  <option value="ALL">全部符合</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                開始時間
                <Input
                  type="time"
                  value={rule.conditions.startTime ?? ""}
                  onChange={(event) =>
                    updateRule(index, {
                      conditions: {
                        ...rule.conditions,
                        startTime: event.target.value || null
                      }
                    })
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                結束時間
                <Input
                  type="time"
                  value={rule.conditions.endTime ?? ""}
                  onChange={(event) =>
                    updateRule(index, {
                      conditions: {
                        ...rule.conditions,
                        endTime: event.target.value || null
                      }
                    })
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                時區
                <Input
                  value={rule.conditions.timeZone}
                  onChange={(event) =>
                    updateRule(index, {
                      conditions: {
                        ...rule.conditions,
                        timeZone: event.target.value
                      }
                    })
                  }
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              {weekdayLabels.map((label, day) => (
                <label key={label} className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={rule.conditions.activeDays.includes(day)}
                    onChange={(event) =>
                      updateRule(index, {
                        conditions: {
                          ...rule.conditions,
                          activeDays: event.target.checked
                            ? [...rule.conditions.activeDays, day].sort()
                            : rule.conditions.activeDays.filter((value) => value !== day)
                        }
                      })
                    }
                  />
                  週{label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">動作</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  updateRule(index, {
                    actions: [...rule.actions, blankAction("SEND_MESSAGE")]
                  })
                }
              >
                <Plus size={14} />
                新增動作
              </Button>
            </div>
            {rule.actions.map((action, actionIndex) => (
              <div
                key={actionIndex}
                className="grid gap-3 rounded-lg border border-border p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <select
                    className="h-10 rounded-md border border-border bg-input px-3 text-sm"
                    value={action.type}
                    onChange={(event) =>
                      updateAction(
                        index,
                        actionIndex,
                        blankAction(event.target.value as AutomationActionTypeKey)
                      )
                    }
                  >
                    {automationActionTypes.map((type) => (
                      <option key={type} value={type}>
                        {automationActionLabels[type]}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={rule.actions.length === 1}
                    onClick={() =>
                      updateRule(index, {
                        actions: rule.actions.filter(
                          (_, currentIndex) => currentIndex !== actionIndex
                        )
                      })
                    }
                    aria-label="刪除動作"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>

                {action.type === "SEND_MESSAGE" ? (
                  <div className="grid gap-3 md:grid-cols-[260px_1fr]">
                    <label className="grid gap-2 text-sm font-medium">
                      傳送頻道（留空使用事件頻道）
                      <DiscordChannelSelect
                        value={action.channelId ?? ""}
                        onValueChange={(channelId) =>
                          updateAction(index, actionIndex, {
                            ...action,
                            channelId: channelId || null
                          })
                        }
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium">
                      訊息內容
                      <Textarea
                        value={action.content}
                        onChange={(event) =>
                          updateAction(index, actionIndex, {
                            ...action,
                            content: event.target.value
                          })
                        }
                      />
                    </label>
                  </div>
                ) : null}

                {action.type === "ADD_ROLE" ? (
                  <label className="grid max-w-sm gap-2 text-sm font-medium">
                    給予身分組
                    <DiscordRoleSelect
                      value={action.roleId}
                      assignableOnly
                      allowEmpty={false}
                      onValueChange={(roleId) =>
                        updateAction(index, actionIndex, { ...action, roleId })
                      }
                    />
                  </label>
                ) : null}

                {action.type === "TIMEOUT_MEMBER" ? (
                  <div className="grid gap-3 md:grid-cols-[180px_1fr]">
                    <label className="grid gap-2 text-sm font-medium">
                      秒數
                      <Input
                        type="number"
                        min={60}
                        max={2_419_200}
                        value={action.durationSeconds}
                        onChange={(event) =>
                          updateAction(index, actionIndex, {
                            ...action,
                            durationSeconds: Number(event.target.value)
                          })
                        }
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium">
                      原因
                      <Input
                        value={action.reason ?? ""}
                        onChange={(event) =>
                          updateAction(index, actionIndex, {
                            ...action,
                            reason: event.target.value || null
                          })
                        }
                      />
                    </label>
                  </div>
                ) : null}

                {action.type === "KICK_MEMBER" || action.type === "BAN_MEMBER" ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="grid gap-2 text-sm font-medium">
                      原因
                      <Input
                        value={action.reason ?? ""}
                        onChange={(event) =>
                          updateAction(index, actionIndex, {
                            ...action,
                            reason: event.target.value || null
                          })
                        }
                      />
                    </label>
                    {action.type === "BAN_MEMBER" ? (
                      <label className="grid gap-2 text-sm font-medium">
                        刪除最近訊息秒數
                        <Input
                          type="number"
                          min={0}
                          max={604_800}
                          value={action.deleteMessageSeconds}
                          onChange={(event) =>
                            updateAction(index, actionIndex, {
                              ...action,
                              deleteMessageSeconds: Number(event.target.value)
                            })
                          }
                        />
                      </label>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-[180px_1fr_auto] md:items-end">
            <label className="grid gap-2 text-sm font-medium">
              每位成員冷卻秒數
              <Input
                type="number"
                min={0}
                value={rule.cooldownSeconds}
                onChange={(event) =>
                  updateRule(index, { cooldownSeconds: Number(event.target.value) })
                }
              />
            </label>
            <label className="flex items-center gap-2 pb-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={rule.stopProcessing}
                onChange={(event) =>
                  updateRule(index, { stopProcessing: event.target.checked })
                }
              />
              符合後停止處理後續規則
            </label>
            <Button
              type="button"
              variant="outline"
              onClick={() => void testRule(index)}
            >
              <FlaskConical size={16} />
              測試條件
            </Button>
          </div>
          {testMessages[index] ? (
            <p className="text-sm text-muted-foreground">{testMessages[index]}</p>
          ) : null}
        </article>
      ))}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          <Save size={16} />
          儲存自動化
        </Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </form>
  );
}
