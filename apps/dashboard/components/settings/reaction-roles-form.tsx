"use client";

import { ExternalLink, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import type { ReactionRolePanelInput } from "@guildforge/shared";

import {
  DiscordChannelSelect,
  DiscordRoleSelect
} from "@/components/discord-resource-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ReactionRolesFormProps = {
  guildId: string;
  panels: ReactionRolePanelInput[];
};

type PanelsResponse = {
  panels?: ReactionRolePanelInput[];
  error?: string;
};

function blankPanel(): ReactionRolePanelInput {
  return {
    channelId: "",
    title: "選擇你的身分組",
    description: "請使用下方按鈕或表情反應領取身分組。",
    color: "#24b47e",
    mode: "MULTI_SELECT",
    enabled: true,
    options: [{ type: "BUTTON", roleId: "", emoji: "", label: "身分組", sortOrder: 0 }]
  };
}

export function ReactionRolesForm({ guildId, panels }: ReactionRolesFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localPanels, setLocalPanels] = useState(panels);
  const [message, setMessage] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    setLocalPanels(panels);
  }, [panels]);

  useEffect(() => {
    if (!polling) {
      return;
    }

    const controller = new AbortController();
    const timer = setInterval(() => {
      void (async () => {
        const response = await fetch(`/api/guilds/${guildId}/reaction-roles`, {
          signal: controller.signal,
          cache: "no-store"
        }).catch(() => null);

        if (!response?.ok) {
          return;
        }

        const body = (await response.json().catch(() => null)) as PanelsResponse | null;

        if (!body?.panels) {
          return;
        }

        setLocalPanels(body.panels);

        if (
          !body.panels.some(
            (panel) => panel.syncPending && !panel.lastSyncError
          )
        ) {
          setPolling(false);
          setMessage(
            body.panels.some((panel) => panel.lastSyncError)
              ? "設定已儲存，但有面板同步失敗。"
              : "面板已自動同步到 Discord。"
          );
          startTransition(() => router.refresh());
        }
      })();
    }, 3_000);

    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [guildId, polling, router]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch(`/api/guilds/${guildId}/reaction-roles`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ panels: localPanels })
    });
    const body = (await response.json().catch(() => null)) as PanelsResponse | null;

    if (!response.ok || !body?.panels) {
      setMessage(body?.error ?? "無法儲存自助身分組面板。");
      return;
    }

    setLocalPanels(body.panels);
    setMessage("設定已儲存，Hydrava 正在自動同步 Discord 面板。");
    setPolling(
      body.panels.some((panel) => panel.syncPending && !panel.lastSyncError)
    );

    if (
      !body.panels.some(
        (panel) => panel.syncPending && !panel.lastSyncError
      )
    ) {
      startTransition(() => router.refresh());
    }
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">面板</p>
          <p className="mt-1 text-xs text-muted-foreground">
            儲存後會自動建立或更新 Discord 訊息，不需要複製任何 ID。
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setLocalPanels((current) => [...current, blankPanel()])}
        >
          <Plus size={14} aria-hidden="true" />
          新增
        </Button>
      </div>
      {localPanels.map((panel, panelIndex) => (
        <div
          key={panel.id ?? `new-panel-${panelIndex}`}
          className="grid gap-3 rounded-md border border-border p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{panel.title || "新面板"}</p>
              <PanelSyncStatus guildId={guildId} panel={panel} />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`刪除 ${panel.title || "面板"}`}
              onClick={() =>
                setLocalPanels((current) => current.filter((_, index) => index !== panelIndex))
              }
            >
              <Trash2 size={16} aria-hidden="true" />
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              發布頻道
              <DiscordChannelSelect
                value={panel.channelId}
                allowEmpty={false}
                onValueChange={(channelId) =>
                  setLocalPanels((current) =>
                    current.map((item, index) =>
                      index === panelIndex ? { ...item, channelId } : item
                    )
                  )
                }
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              標題
              <Input
                value={panel.title}
                onChange={(event) =>
                  setLocalPanels((current) =>
                    current.map((item, index) =>
                      index === panelIndex ? { ...item, title: event.target.value } : item
                    )
                  )
                }
              />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            說明
            <Textarea
              value={panel.description ?? ""}
              onChange={(event) =>
                setLocalPanels((current) =>
                  current.map((item, index) =>
                    index === panelIndex ? { ...item, description: event.target.value } : item
                  )
                )
              }
            />
          </label>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-medium">
              顏色
              <Input
                type="color"
                value={panel.color}
                onChange={(event) =>
                  setLocalPanels((current) =>
                    current.map((item, index) =>
                      index === panelIndex ? { ...item, color: event.target.value } : item
                    )
                  )
                }
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              選擇模式
              <select
                className="h-10 rounded-md border border-border bg-input px-3 text-sm text-foreground"
                value={panel.mode}
                onChange={(event) =>
                  setLocalPanels((current) =>
                    current.map((item, index) =>
                      index === panelIndex
                        ? { ...item, mode: event.target.value as ReactionRolePanelInput["mode"] }
                        : item
                    )
                  )
                }
              >
                <option value="MULTI_SELECT">可多選</option>
                <option value="SINGLE_SELECT">僅能單選</option>
              </select>
            </label>
            <label className="flex items-center gap-2 pt-7 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={panel.enabled}
                onChange={(event) =>
                  setLocalPanels((current) =>
                    current.map((item, index) =>
                      index === panelIndex ? { ...item, enabled: event.target.checked } : item
                    )
                  )
                }
              />
              已啟用
            </label>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">選項</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setLocalPanels((current) =>
                    current.map((item, index) =>
                      index === panelIndex
                        ? {
                            ...item,
                            options: [
                              ...item.options,
                              {
                                type: "BUTTON",
                                roleId: "",
                                emoji: "",
                                label: "身分組",
                                sortOrder: item.options.length
                              }
                            ]
                          }
                        : item
                    )
                  )
                }
              >
                <Plus size={14} aria-hidden="true" />
                新增
              </Button>
            </div>
            {panel.options.map((option, optionIndex) => (
              <div
                key={option.id ?? `new-option-${panelIndex}-${optionIndex}`}
                className="grid gap-2 md:grid-cols-[110px_1fr_1fr_90px_auto]"
              >
                <select
                  className="h-10 rounded-md border border-border bg-input px-2 text-sm text-foreground"
                  value={option.type}
                  onChange={(event) =>
                    setLocalPanels((current) =>
                      current.map((item, index) =>
                        index === panelIndex
                          ? {
                              ...item,
                              options: item.options.map((currentOption, currentIndex) =>
                                currentIndex === optionIndex
                                  ? {
                                      ...currentOption,
                                      type: event.target.value as typeof option.type
                                    }
                                  : currentOption
                              )
                            }
                          : item
                      )
                    )
                  }
                >
                  <option value="BUTTON">按鈕</option>
                  <option value="REACTION">表情反應</option>
                </select>
                <DiscordRoleSelect
                  value={option.roleId}
                  allowEmpty={false}
                  assignableOnly
                  onValueChange={(roleId) =>
                    setLocalPanels((current) =>
                      current.map((item, index) =>
                        index === panelIndex
                          ? {
                              ...item,
                              options: item.options.map((currentOption, currentIndex) =>
                                currentIndex === optionIndex
                                  ? { ...currentOption, roleId }
                                  : currentOption
                              )
                            }
                          : item
                      )
                    )
                  }
                />
                <Input
                  placeholder="顯示文字"
                  value={option.label}
                  onChange={(event) =>
                    setLocalPanels((current) =>
                      current.map((item, index) =>
                        index === panelIndex
                          ? {
                              ...item,
                              options: item.options.map((currentOption, currentIndex) =>
                                currentIndex === optionIndex
                                  ? { ...currentOption, label: event.target.value }
                                  : currentOption
                              )
                            }
                          : item
                      )
                    )
                  }
                />
                <Input
                  placeholder="表情符號"
                  value={option.emoji ?? ""}
                  onChange={(event) =>
                    setLocalPanels((current) =>
                      current.map((item, index) =>
                        index === panelIndex
                          ? {
                              ...item,
                              options: item.options.map((currentOption, currentIndex) =>
                                currentIndex === optionIndex
                                  ? { ...currentOption, emoji: event.target.value }
                                  : currentOption
                              )
                            }
                          : item
                      )
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`刪除 ${option.label || "選項"}`}
                  onClick={() =>
                    setLocalPanels((current) =>
                      current.map((item, index) =>
                        index === panelIndex
                          ? {
                              ...item,
                              options: item.options.filter(
                                (_, currentIndex) => currentIndex !== optionIndex
                              )
                            }
                          : item
                      )
                    )
                  }
                >
                  <Trash2 size={16} aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          <Save size={16} aria-hidden="true" />
          儲存並同步
        </Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </form>
  );
}

function PanelSyncStatus({
  guildId,
  panel
}: {
  guildId: string;
  panel: ReactionRolePanelInput;
}) {
  if (!panel.id) {
    return <p className="mt-1 text-xs text-muted-foreground">尚未儲存</p>;
  }

  if (panel.lastSyncError) {
    return (
      <p className="mt-1 max-w-2xl text-xs text-destructive">
        同步失敗：{panel.lastSyncError}
      </p>
    );
  }

  if (panel.syncPending) {
    return <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">等待自動同步…</p>;
  }

  if (panel.messageId && panel.publishedChannelId) {
    return (
      <a
        className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
        href={`https://discord.com/channels/${guildId}/${panel.publishedChannelId}/${panel.messageId}`}
        target="_blank"
        rel="noreferrer"
      >
        已同步到 Discord
        <ExternalLink size={12} aria-hidden="true" />
      </a>
    );
  }

  return (
    <p className="mt-1 text-xs text-muted-foreground">
      {panel.enabled ? "等待首次發布" : "已停用"}
    </p>
  );
}
