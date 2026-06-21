"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { CustomCommandInput } from "@guildforge/shared";

import {
  DiscordChannelMultiSelect,
  DiscordRoleMultiSelect
} from "@/components/discord-resource-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type CustomCommandsFormProps = {
  guildId: string;
  commandPrefix: string;
  commands: CustomCommandInput[];
};

function blankCommand(): CustomCommandInput {
  return {
    name: "nihao",
    description: "",
    responseText: "你好，{user}！",
    cooldownSeconds: 5,
    allowedRoleIds: [],
    allowedChannelIds: [],
    enabled: true
  };
}

export function CustomCommandsForm({ guildId, commandPrefix, commands }: CustomCommandsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [prefix, setPrefix] = useState(commandPrefix);
  const [localCommands, setLocalCommands] = useState(commands);
  const [message, setMessage] = useState<string | null>(null);

  function updateCommand(index: number, patch: Partial<CustomCommandInput>) {
    setLocalCommands((current) =>
      current.map((command, itemIndex) => (itemIndex === index ? { ...command, ...patch } : command))
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch(`/api/guilds/${guildId}/custom-commands`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        commandPrefix: prefix,
        commands: localCommands.map((command) => ({
          ...command,
          name: command.name.toLowerCase().trim()
        }))
      })
    });

    if (!response.ok) {
      setMessage("無法儲存自訂指令。");
      return;
    }

    setMessage("已儲存。");
    startTransition(() => router.refresh());
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <label className="grid max-w-xs gap-2 text-sm font-medium">
        指令前綴
        <Input value={prefix} onChange={(event) => setPrefix(event.target.value)} />
      </label>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">指令</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setLocalCommands((current) => [...current, blankCommand()])}
        >
          <Plus size={14} aria-hidden="true" />
          新增
        </Button>
      </div>
      {localCommands.map((command, index) => (
        <div key={`${command.name}-${index}`} className="grid gap-3 rounded-md border border-border p-3">
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={command.enabled}
                onChange={(event) => updateCommand(index, { enabled: event.target.checked })}
              />
              已啟用
            </label>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setLocalCommands((current) => current.filter((_, itemIndex) => itemIndex !== index))}
            >
              <Trash2 size={16} aria-hidden="true" />
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_130px]">
            <label className="grid gap-2 text-sm font-medium">
              名稱
              <Input
                value={command.name}
                onChange={(event) => updateCommand(index, { name: event.target.value })}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              說明
              <Input
                value={command.description ?? ""}
                onChange={(event) => updateCommand(index, { description: event.target.value })}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              冷卻秒數
              <Input
                type="number"
                min={0}
                value={command.cooldownSeconds}
                onChange={(event) =>
                  updateCommand(index, { cooldownSeconds: Number(event.target.value) })
                }
              />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            回覆內容
            <Textarea
              value={command.responseText}
              onChange={(event) => updateCommand(index, { responseText: event.target.value })}
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2 text-sm font-medium">
              <p>允許的身分組</p>
              <DiscordRoleMultiSelect
                ariaLabel={`${command.name || "自訂指令"}允許的身分組`}
                values={command.allowedRoleIds}
                onValuesChange={(allowedRoleIds) => updateCommand(index, { allowedRoleIds })}
              />
            </div>
            <div className="grid gap-2 text-sm font-medium">
              <p>允許的頻道</p>
              <DiscordChannelMultiSelect
                ariaLabel={`${command.name || "自訂指令"}允許的頻道`}
                values={command.allowedChannelIds}
                onValuesChange={(allowedChannelIds) =>
                  updateCommand(index, { allowedChannelIds })
                }
              />
            </div>
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
