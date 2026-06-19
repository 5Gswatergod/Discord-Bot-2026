"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { GuildModuleKey } from "@guildforge/shared";
import { moduleLabels } from "@guildforge/shared";

import { Button } from "@/components/ui/button";

type ModuleToggleFormProps = {
  guildId: string;
  modules: Array<{
    module: GuildModuleKey;
    enabled: boolean;
  }>;
};

export function ModuleToggleForm({ guildId, modules }: ModuleToggleFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localModules, setLocalModules] = useState(modules);
  const [message, setMessage] = useState<string | null>(null);

  async function saveModule(module: GuildModuleKey, enabled: boolean) {
    setMessage(null);
    const response = await fetch(`/api/guilds/${guildId}/modules`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        module,
        enabled
      })
    });

    if (!response.ok) {
      setMessage("無法儲存模組狀態。");
      return;
    }

    setLocalModules((current) =>
      current.map((item) => (item.module === module ? { ...item, enabled } : item))
    );
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      {localModules.map((item) => (
        <label
          key={item.module}
          className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
        >
          <span className="text-sm font-medium">{moduleLabels[item.module]}</span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={item.enabled}
            disabled={pending}
            onChange={(event) => void saveModule(item.module, event.target.checked)}
          />
        </label>
      ))}
      {message ? <p className="text-sm text-red-600">{message}</p> : null}
      <Button type="button" variant="secondary" disabled>
        <Save size={16} aria-hidden="true" />
        已自動儲存
      </Button>
    </div>
  );
}
