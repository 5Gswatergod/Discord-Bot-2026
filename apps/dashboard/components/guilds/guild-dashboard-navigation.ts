import {
  BarChart3,
  BellRing,
  Bot,
  CakeSlice,
  CalendarClock,
  CircleDollarSign,
  Command,
  FileText,
  Gift,
  Hand,
  LayoutDashboard,
  ListChecks,
  MailPlus,
  Medal,
  MessagesSquare,
  Mic2,
  ScrollText,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  TicketCheck,
  Vote,
  Workflow,
  type LucideIcon
} from "lucide-react";

export type DashboardNavigationItem = {
  href: `#${string}`;
  label: string;
  icon: LucideIcon;
};

export type DashboardNavigationGroup = {
  label: string;
  items: readonly DashboardNavigationItem[];
};

export const dashboardNavigationGroups: readonly DashboardNavigationGroup[] = [
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
      { href: "#custom-commands", label: "自訂指令", icon: Command },
      { href: "#starboard", label: "熱門訊息牆", icon: Star },
      { href: "#achievements", label: "成就與獎勵", icon: Medal },
      { href: "#birthdays", label: "生日祝福", icon: CakeSlice }
    ]
  },
  {
    label: "活動與成長",
    items: [
      { href: "#economy", label: "貨幣系統", icon: CircleDollarSign },
      { href: "#economy-shop", label: "商店管理", icon: ShoppingBag },
      { href: "#giveaways", label: "抽獎", icon: Gift },
      { href: "#polls", label: "投票", icon: Vote },
      { href: "#social-alerts", label: "社群通知", icon: BellRing },
      { href: "#embed-messages", label: "嵌入訊息", icon: FileText },
      { href: "#reminders", label: "提醒事項", icon: CalendarClock },
      { href: "#server-stats", label: "伺服器統計", icon: BarChart3 },
      { href: "#temporary-voice", label: "臨時語音", icon: Mic2 },
      { href: "#automations", label: "進階自動化", icon: Workflow }
    ]
  },
  {
    label: "選配整合",
    items: [
      { href: "#ai-assistant", label: "Hydrava AI", icon: Bot },
      { href: "#memberships", label: "付費會員", icon: CircleDollarSign },
      { href: "#web3", label: "NFT／Web3", icon: ShieldCheck }
    ]
  }
] as const;

export const dashboardNavigationItems = dashboardNavigationGroups.flatMap((group) => group.items);
