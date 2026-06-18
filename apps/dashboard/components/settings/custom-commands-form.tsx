"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { CustomCommandInput } from "@guildforge/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type CustomCommandsFormProps = {
  guildId: string;
  commandPrefix: string;
  commands: CustomCommandInput[];
};

function splitIds(value: string) {
  return value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function blankCommand(): CustomCommandInput {
  return {
    name: "hello",
    description: "",
    responseText: "Hello {user}!",
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
      setMessage("Failed to save custom commands.");
      return;
    }

    setMessage("Saved.");
    startTransition(() => router.refresh());
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <label className="grid max-w-xs gap-2 text-sm font-medium">
        Prefix
        <Input value={prefix} onChange={(event) => setPrefix(event.target.value)} />
      </label>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Commands</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setLocalCommands((current) => [...current, blankCommand()])}
        >
          <Plus size={14} aria-hidden="true" />
          Add
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
              Enabled
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
              Name
              <Input
                value={command.name}
                onChange={(event) => updateCommand(index, { name: event.target.value })}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Description
              <Input
                value={command.description ?? ""}
                onChange={(event) => updateCommand(index, { description: event.target.value })}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Cooldown
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
            Response
            <Textarea
              value={command.responseText}
              onChange={(event) => updateCommand(index, { responseText: event.target.value })}
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              Allowed role IDs
              <Input
                value={command.allowedRoleIds.join(", ")}
                onChange={(event) =>
                  updateCommand(index, { allowedRoleIds: splitIds(event.target.value) })
                }
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Allowed channel IDs
              <Input
                value={command.allowedChannelIds.join(", ")}
                onChange={(event) =>
                  updateCommand(index, { allowedChannelIds: splitIds(event.target.value) })
                }
              />
            </label>
          </div>
        </div>
      ))}
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
