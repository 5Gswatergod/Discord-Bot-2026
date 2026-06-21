import {
  Activity,
  BellRing,
  Bot,
  CalendarClock,
  ChevronDown,
  CircleDollarSign,
  Command,
  FileText,
  Gift,
  Hand,
  LayoutDashboard,
  ListChecks,
  MailPlus,
  MessagesSquare,
  ScrollText,
  Settings2,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  Users
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { ManageableGuild } from "@/lib/discord";
import { SignOutButton } from "@/components/auth-button";
import { DiscordResourcesProvider } from "@/components/discord-resource-picker";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";

type GuildDashboardShellProps = {
  guild: ManageableGuild;
  enabledModuleCount: number;
  auditCount: number;
  children: React.ReactNode;
};

const navigationGroups = [
  {
    label: "總覽",
    items: [
      { href: "#overview", label: "控制面板", icon: LayoutDashboard },
      { href: "#modules", label: "功能中心", icon: Settings2 }
    ]
  },
  {
    label: "伺服器管理",
    items: [
      { href: "#moderation", label: "管理功能", icon: ShieldCheck },
      { href: "#automod", label: "自動管理", icon: Sparkles },
      { href: "#logging", label: "伺服器紀錄", icon: ScrollText },
      { href: "#tickets", label: "客服單", icon: TicketCheck },
      { href: "#invite-tracking", label: "邀請追蹤", icon: MailPlus }
    ]
  },
  {
    label: "社群互動",
    items: [
      { href: "#welcome", label: "歡迎與離開", icon: Hand },
      { href: "#leveling", label: "等級系統", icon: ListChecks },
      { href: "#reaction-roles", label: "自助身分組", icon: MessagesSquare },
      { href: "#custom-commands", label: "自訂指令", icon: Command }
    ]
  },
  {
    label: "活動與成長",
    items: [
      { href: "#economy", label: "貨幣與商店", icon: CircleDollarSign },
      { href: "#giveaways", label: "抽獎與投票", icon: Gift },
      { href: "#social-alerts", label: "社群通知", icon: BellRing },
      { href: "#embed-messages", label: "嵌入訊息", icon: FileText },
      { href: "#reminders", label: "提醒事項", icon: CalendarClock }
    ]
  }
] as const;

export function GuildDashboardShell({
  guild,
  enabledModuleCount,
  auditCount,
  children
}: GuildDashboardShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="flex h-[72px] items-center">
          <Link
            href="/guilds"
            className="hidden h-full w-[280px] shrink-0 items-center gap-3 border-r border-border px-6 lg:flex"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Bot size={22} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-base font-bold tracking-wide">Hydrava</span>
              <span className="block text-[11px] text-muted-foreground">Community Console</span>
            </span>
          </Link>

          <div className="flex min-w-0 flex-1 items-center justify-between gap-4 px-4 sm:px-6">
            <Link
              href="/guilds"
              className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 transition-colors hover:bg-muted"
            >
              <GuildIcon guild={guild} size="small" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{guild.name}</span>
                <span className="block text-[11px] text-muted-foreground">切換伺服器</span>
              </span>
              <ChevronDown
                className="shrink-0 text-muted-foreground"
                size={15}
                aria-hidden="true"
              />
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              <ThemeToggle />
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="sticky top-[72px] hidden h-[calc(100vh-72px)] overflow-y-auto border-r border-border bg-card/40 px-4 py-6 lg:block">
          <div className="mb-6 rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-3">
              <GuildIcon guild={guild} size="large" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{guild.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {guild.memberCount?.toLocaleString("zh-TW") ?? "-"} 位成員
                </p>
              </div>
            </div>
          </div>

          <nav className="space-y-6" aria-label="伺服器設定">
            {navigationGroups.map((group) => (
              <div key={group.label}>
                <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;

                    return (
                      <a
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Icon size={17} aria-hidden="true" />
                        {item.label}
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[1280px] space-y-6">
            <div className="flex gap-2 overflow-x-auto pb-2 lg:hidden">
              {navigationGroups.flatMap((group) =>
                group.items.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="shrink-0 rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground"
                  >
                    {item.label}
                  </a>
                ))
              )}
            </div>

            <section
              id="overview"
              className="dashboard-hero scroll-mt-28 overflow-hidden rounded-2xl border border-primary/20 p-6 sm:p-8"
            >
              <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
                <div className="flex min-w-0 items-center gap-4">
                  <GuildIcon guild={guild} size="hero" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={guild.botJoined ? "default" : "warning"}>
                        {guild.botJoined ? "機器人已連線" : "尚未安裝機器人"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">即時設定中心</span>
                    </div>
                    <h1 className="mt-3 truncate text-2xl font-bold sm:text-3xl">{guild.name}</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                      從這裡啟用功能、調整規則並管理社群活動。所有變更都會套用到這個 Discord
                      伺服器。
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <Metric
                    icon={Users}
                    label="成員"
                    value={guild.memberCount?.toLocaleString("zh-TW") ?? "-"}
                  />
                  <Metric icon={Settings2} label="已啟用" value={enabledModuleCount.toString()} />
                  <Metric icon={Activity} label="近期事件" value={auditCount.toString()} />
                </div>
              </div>
            </section>

            <DiscordResourcesProvider guildId={guild.id}>{children}</DiscordResourcesProvider>
          </div>
        </main>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="dashboard-hero-metric min-w-20 rounded-xl border px-3 py-3 text-center backdrop-blur sm:min-w-28 sm:px-4">
      <Icon className="mx-auto text-primary" size={17} aria-hidden="true" />
      <p className="mt-2 text-lg font-bold sm:text-xl">{value}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">{label}</p>
    </div>
  );
}

function GuildIcon({ guild, size }: { guild: ManageableGuild; size: "small" | "large" | "hero" }) {
  const classes = {
    small: "h-8 w-8 rounded-lg",
    large: "h-11 w-11 rounded-xl",
    hero: "h-16 w-16 rounded-2xl sm:h-20 sm:w-20"
  }[size];
  const pixels = size === "hero" ? 80 : size === "large" ? 44 : 32;

  if (guild.iconUrl) {
    return (
      <Image
        src={guild.iconUrl}
        alt=""
        width={pixels}
        height={pixels}
        className={`${classes} shrink-0 bg-muted object-cover`}
        unoptimized={guild.iconUrl.includes(".gif")}
      />
    );
  }

  return (
    <span
      className={`${classes} flex shrink-0 items-center justify-center bg-primary/15 font-bold text-primary`}
    >
      {guild.name.slice(0, 2).toUpperCase()}
    </span>
  );
}
