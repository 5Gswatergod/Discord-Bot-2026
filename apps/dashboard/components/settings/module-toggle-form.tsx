"use client";

import {
  BarChart3,
  BellRing,
  CakeSlice,
  CalendarClock,
  Check,
  CircleDollarSign,
  Command,
  FileText,
  Gift,
  Hand,
  MailPlus,
  Medal,
  Mic2,
  ListChecks,
  MessagesSquare,
  ScrollText,
  TicketCheck,
  ShieldCheck,
  Star,
  Sparkles,
  Workflow,
  type LucideIcon
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { GuildModuleKey } from "@guildforge/shared";
import { moduleDescriptions, moduleLabels } from "@guildforge/shared";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ModuleToggleFormProps = {
  guildId: string;
  modules: Array<{
    module: GuildModuleKey;
    enabled: boolean;
  }>;
};

const moduleIcons: Record<GuildModuleKey, LucideIcon> = {
  MODERATION: ShieldCheck,
  AUTO_MODERATION: Sparkles,
  LEVELING: ListChecks,
  ECONOMY: CircleDollarSign,
  WELCOME: Hand,
  REACTION_ROLES: MessagesSquare,
  CUSTOM_COMMANDS: Command,
  LOGGING: ScrollText,
  GIVEAWAYS: Gift,
  POLLS: Check,
  SOCIAL_ALERTS: BellRing,
  TICKETS: TicketCheck,
  INVITE_TRACKING: MailPlus,
  EMBED_MESSAGES: FileText,
  REMINDERS: CalendarClock,
  STARBOARD: Star,
  ACHIEVEMENTS: Medal,
  BIRTHDAYS: CakeSlice,
  SERVER_STATS: BarChart3,
  TEMPORARY_VOICE: Mic2,
  AUTOMATIONS: Workflow
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
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {localModules.map((item) => (
          <ModuleCard
            key={item.module}
            module={item.module}
            enabled={item.enabled}
            pending={pending}
            onToggle={(enabled) => void saveModule(item.module, enabled)}
          />
        ))}
      </div>
      {message ? <p className="text-sm text-red-700 dark:text-red-300">{message}</p> : null}
      <p className="text-xs text-muted-foreground">變更會立即自動儲存並套用至機器人。</p>
    </div>
  );
}

function ModuleCard({
  module,
  enabled,
  pending,
  onToggle
}: {
  module: GuildModuleKey;
  enabled: boolean;
  pending: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  const Icon = moduleIcons[module];

  return (
    <article
      className={cn(
        "group flex min-h-60 flex-col rounded-xl border p-5 transition-all",
        enabled
          ? "border-primary/35 bg-primary/[0.06] shadow-[0_12px_40px_rgba(45,212,191,0.08)]"
          : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/25"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl border",
            enabled
              ? "border-primary/25 bg-primary/15 text-primary"
              : "border-border bg-muted text-muted-foreground group-hover:text-foreground"
          )}
        >
          <Icon size={22} aria-hidden="true" />
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold",
            enabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
          )}
        >
          {enabled ? "運作中" : "未啟用"}
        </span>
      </div>
      <div className="mt-5 flex-1">
        <h3 className="font-semibold text-foreground">{moduleLabels[module]}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{moduleDescriptions[module]}</p>
      </div>
      <Button
        type="button"
        variant={enabled ? "secondary" : "default"}
        className="mt-5 w-full"
        disabled={pending}
        onClick={() => onToggle(!enabled)}
      >
        {enabled ? "停用功能" : "啟用功能"}
      </Button>
    </article>
  );
}
