"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { ReactionRolePanelInput } from "@guildforge/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ReactionRolesFormProps = {
  guildId: string;
  panels: ReactionRolePanelInput[];
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

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch(`/api/guilds/${guildId}/reaction-roles`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ panels: localPanels })
    });

    if (!response.ok) {
      setMessage("無法儲存自助身分組面板。");
      return;
    }

    setMessage("已儲存。請使用「/自助身分組 發布」發佈面板。");
    startTransition(() => router.refresh());
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">面板</p>
        <Button type="button" size="sm" variant="outline" onClick={() => setLocalPanels((current) => [...current, blankPanel()])}>
          <Plus size={14} aria-hidden="true" />
          新增
        </Button>
      </div>
      {localPanels.map((panel, panelIndex) => (
        <div key={panel.id ?? panelIndex} className="grid gap-3 rounded-md border border-border p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">{panel.id ? `面板 ${panel.id}` : "新面板"}</p>
            <Button type="button" variant="ghost" size="icon" onClick={() => setLocalPanels((current) => current.filter((_, index) => index !== panelIndex))}>
              <Trash2 size={16} aria-hidden="true" />
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              頻道 ID
              <Input value={panel.channelId} onChange={(event) => setLocalPanels((current) => current.map((item, index) => index === panelIndex ? { ...item, channelId: event.target.value } : item))} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              標題
              <Input value={panel.title} onChange={(event) => setLocalPanels((current) => current.map((item, index) => index === panelIndex ? { ...item, title: event.target.value } : item))} />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            說明
            <Textarea value={panel.description ?? ""} onChange={(event) => setLocalPanels((current) => current.map((item, index) => index === panelIndex ? { ...item, description: event.target.value } : item))} />
          </label>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-medium">
              顏色
              <Input type="color" value={panel.color} onChange={(event) => setLocalPanels((current) => current.map((item, index) => index === panelIndex ? { ...item, color: event.target.value } : item))} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              選擇模式
              <select className="h-10 rounded-md border border-border bg-white px-3 text-sm" value={panel.mode} onChange={(event) => setLocalPanels((current) => current.map((item, index) => index === panelIndex ? { ...item, mode: event.target.value as ReactionRolePanelInput["mode"] } : item))}>
                <option value="MULTI_SELECT">可多選</option>
                <option value="SINGLE_SELECT">僅能單選</option>
              </select>
            </label>
            <label className="flex items-center gap-2 pt-7 text-sm font-medium">
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={panel.enabled} onChange={(event) => setLocalPanels((current) => current.map((item, index) => index === panelIndex ? { ...item, enabled: event.target.checked } : item))} />
              已啟用
            </label>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">選項</p>
              <Button type="button" size="sm" variant="outline" onClick={() => setLocalPanels((current) => current.map((item, index) => index === panelIndex ? { ...item, options: [...item.options, { type: "BUTTON", roleId: "", emoji: "", label: "身分組", sortOrder: item.options.length }] } : item))}>
                <Plus size={14} aria-hidden="true" />
                新增
              </Button>
            </div>
            {panel.options.map((option, optionIndex) => (
              <div key={`${option.roleId}-${optionIndex}`} className="grid gap-2 md:grid-cols-[110px_1fr_1fr_90px_auto]">
                <select className="h-10 rounded-md border border-border bg-white px-2 text-sm" value={option.type} onChange={(event) => setLocalPanels((current) => current.map((item, index) => index === panelIndex ? { ...item, options: item.options.map((currentOption, currentIndex) => currentIndex === optionIndex ? { ...currentOption, type: event.target.value as typeof option.type } : currentOption) } : item))}>
                  <option value="BUTTON">按鈕</option>
                  <option value="REACTION">表情反應</option>
                </select>
                <Input placeholder="身分組 ID" value={option.roleId} onChange={(event) => setLocalPanels((current) => current.map((item, index) => index === panelIndex ? { ...item, options: item.options.map((currentOption, currentIndex) => currentIndex === optionIndex ? { ...currentOption, roleId: event.target.value } : currentOption) } : item))} />
                <Input placeholder="顯示文字" value={option.label} onChange={(event) => setLocalPanels((current) => current.map((item, index) => index === panelIndex ? { ...item, options: item.options.map((currentOption, currentIndex) => currentIndex === optionIndex ? { ...currentOption, label: event.target.value } : currentOption) } : item))} />
                <Input placeholder="表情符號" value={option.emoji ?? ""} onChange={(event) => setLocalPanels((current) => current.map((item, index) => index === panelIndex ? { ...item, options: item.options.map((currentOption, currentIndex) => currentIndex === optionIndex ? { ...currentOption, emoji: event.target.value } : currentOption) } : item))} />
                <Button type="button" variant="ghost" size="icon" onClick={() => setLocalPanels((current) => current.map((item, index) => index === panelIndex ? { ...item, options: item.options.filter((_, currentIndex) => currentIndex !== optionIndex) } : item))}>
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
          儲存
        </Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </form>
  );
}
