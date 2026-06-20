import { ArrowLeft, Activity, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import {
  autoModRuleInputSchema,
  autoModTriggers,
  economySettingsSchema,
  logEvents,
  levelingSettingsSchema,
  moduleDescriptions,
  moduleKeys,
  moduleLabels,
  moderationSettingsSchema,
  reactionRolePanelInputSchema,
  socialAlertInputSchema,
  welcomeSettingsSchema,
  type AutoModRuleInput,
  type CustomCommandInput,
  type EconomyShopItemInput,
  type GuildLogEvent,
  type GuildModuleKey,
  type ReactionRolePanelInput,
  type SocialAlertInput
} from "@guildforge/shared";

import { SignOutButton } from "@/components/auth-button";
import { AutoModSettingsForm } from "@/components/settings/automod-settings-form";
import { CustomCommandsForm } from "@/components/settings/custom-commands-form";
import { EconomySettingsForm } from "@/components/settings/economy-settings-form";
import { EconomyShopForm } from "@/components/settings/economy-shop-form";
import { GiveawaysForm, type DashboardGiveawayInput } from "@/components/settings/giveaways-form";
import { LevelingSettingsForm } from "@/components/settings/leveling-settings-form";
import { LoggingSettingsForm } from "@/components/settings/logging-settings-form";
import { ModerationSettingsForm } from "@/components/settings/moderation-settings-form";
import { ModuleToggleForm } from "@/components/settings/module-toggle-form";
import { PollsForm, type DashboardPollInput } from "@/components/settings/polls-form";
import { ReactionRolesForm } from "@/components/settings/reaction-roles-form";
import { SocialAlertsForm } from "@/components/settings/social-alerts-form";
import { WelcomeSettingsForm } from "@/components/settings/welcome-settings-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireManageableGuild } from "@/lib/guild-access";
import { prisma } from "@/lib/prisma";

type GuildOverviewPageProps = {
  params: {
    guildId: string;
  };
};

const auditActionLabels: Record<string, string> = {
  BOT_JOINED_GUILD: "機器人加入伺服器",
  DASHBOARD_MODULE_TOGGLE: "變更功能模組狀態",
  DASHBOARD_MODERATION_SETTINGS_UPDATE: "更新管理功能設定",
  DASHBOARD_WELCOME_SETTINGS_UPDATE: "更新歡迎訊息設定",
  DASHBOARD_LOGGING_SETTINGS_UPDATE: "更新伺服器紀錄設定",
  DASHBOARD_LEVELING_SETTINGS_UPDATE: "更新等級設定",
  DASHBOARD_AUTOMOD_SETTINGS_UPDATE: "更新自動管理設定",
  DASHBOARD_CUSTOM_COMMANDS_UPDATE: "更新自訂指令",
  DASHBOARD_REACTION_ROLES_UPDATE: "更新自助身分組",
  DASHBOARD_GIVEAWAYS_UPDATE: "更新抽獎",
  DASHBOARD_POLLS_UPDATE: "更新投票",
  DASHBOARD_SOCIAL_ALERTS_UPDATE: "更新社群通知",
  DASHBOARD_ECONOMY_SETTINGS_UPDATE: "更新貨幣系統設定",
  DASHBOARD_ECONOMY_SHOP_UPDATE: "更新商店商品",
  ECONOMY_ADMIN_ADD: "管理員增加餘額",
  ECONOMY_ADMIN_REMOVE: "管理員扣除餘額",
  ECONOMY_ADMIN_SET: "管理員設定餘額",
  CUSTOM_COMMAND_RUN: "執行自訂指令",
  LEVEL_UP: "成員升級"
};

const economyTransactionLabels: Record<string, string> = {
  MESSAGE_REWARD: "聊天獎勵",
  DAILY_REWARD: "每日簽到",
  TRANSFER_SENT: "轉出",
  TRANSFER_RECEIVED: "轉入",
  TRANSFER_FEE: "轉帳手續費",
  LEVEL_REWARD: "升級獎勵",
  SHOP_PURCHASE: "購買商品",
  ADMIN_ADD: "管理員增加",
  ADMIN_REMOVE: "管理員扣除",
  ADMIN_SET: "管理員設定",
  REFUND: "退款"
};

const moderationAuditLabels: Record<string, string> = {
  BAN: "封鎖",
  KICK: "踢除",
  TIMEOUT: "禁言",
  WARN: "警告",
  CLEAR: "清除訊息",
  MUTE: "靜音",
  UNMUTE: "解除靜音",
  SLOWMODE: "慢速模式",
  LOCK: "鎖定頻道",
  UNLOCK: "解鎖頻道",
  AUTOMOD_DELETE_MESSAGE: "自動管理刪除訊息",
  AUTOMOD_WARN: "自動管理警告",
  AUTOMOD_TIMEOUT: "自動管理禁言",
  AUTOMOD_KICK: "自動管理踢除",
  AUTOMOD_BAN: "自動管理封鎖"
};

function formatAuditAction(action: string) {
  if (auditActionLabels[action]) {
    return auditActionLabels[action];
  }

  if (action.startsWith("MODERATION_")) {
    const moderationAction = action.slice("MODERATION_".length);
    return `管理操作：${moderationAuditLabels[moderationAction] ?? moderationAction}`;
  }

  return action;
}

export default async function GuildOverviewPage({ params }: GuildOverviewPageProps) {
  const { guild } = await requireManageableGuild(params.guildId);
  const dbGuild = await prisma.guild.findUnique({
    where: {
      id: params.guildId
    },
    include: {
      moduleConfigs: {
        orderBy: {
          module: "asc"
        }
      },
      auditLogs: {
        take: 5,
        orderBy: {
          createdAt: "desc"
        }
      },
      welcomeConfig: true,
      config: true,
      logConfigs: true,
      levelRewards: {
        orderBy: {
          level: "asc"
        }
      },
      levelingUsers: {
        take: 5,
        orderBy: [
          {
            xp: "desc"
          },
          {
            updatedAt: "asc"
          }
        ]
      },
      economyAccounts: {
        take: 5,
        orderBy: [
          {
            balance: "desc"
          },
          {
            updatedAt: "asc"
          }
        ]
      },
      economyTransactions: {
        take: 10,
        orderBy: {
          createdAt: "desc"
        }
      },
      economyShopItems: {
        orderBy: {
          createdAt: "asc"
        }
      },
      autoModRules: true,
      customCommands: {
        orderBy: {
          name: "asc"
        }
      },
      reactionRolePanels: {
        include: {
          options: {
            orderBy: {
              sortOrder: "asc"
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      },
      giveaways: {
        take: 5,
        orderBy: {
          endsAt: "asc"
        }
      },
      polls: {
        take: 5,
        include: {
          options: {
            orderBy: {
              sortOrder: "asc"
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      },
      socialAlerts: {
        orderBy: {
          updatedAt: "desc"
        }
      },
      warnings: {
        take: 5,
        orderBy: {
          createdAt: "desc"
        }
      }
    }
  });
  const moduleConfigMap = new Map(
    (dbGuild?.moduleConfigs ?? []).map((moduleConfig) => [
      moduleConfig.module as GuildModuleKey,
      moduleConfig
    ])
  );
  const modules = moduleKeys.map((module) => ({
    module,
    enabled: moduleConfigMap.get(module)?.enabled ?? false
  }));
  const moderationSettings = moderationSettingsSchema.parse(
    moduleConfigMap.get("MODERATION")?.settings ?? {}
  );
  const welcomeSettings = welcomeSettingsSchema.parse(dbGuild?.welcomeConfig ?? {});
  const levelingSettings = levelingSettingsSchema.parse(
    moduleConfigMap.get("LEVELING")?.settings ?? {}
  );
  const economySettings = economySettingsSchema.parse(
    moduleConfigMap.get("ECONOMY")?.settings ?? {}
  );
  const levelRewards =
    dbGuild?.levelRewards.map((reward) => ({
      level: reward.level,
      roleId: reward.roleId,
      stackable: reward.stackable
    })) ?? [];
  const autoModRuleMap = new Map((dbGuild?.autoModRules ?? []).map((rule) => [rule.trigger, rule]));
  const autoModRules: AutoModRuleInput[] = autoModTriggers.map((trigger) => {
    const rule = autoModRuleMap.get(trigger);

    return autoModRuleInputSchema.parse({
      trigger,
      enabled: rule?.enabled ?? false,
      punishment: rule?.punishment ?? "DELETE_MESSAGE",
      punishmentDurationSeconds: rule?.punishmentDurationSeconds ?? null,
      ignoredChannelIds: rule?.ignoredChannelIds ?? [],
      ignoredRoleIds: rule?.ignoredRoleIds ?? [],
      pattern: rule?.pattern ?? {}
    });
  });
  const customCommands: CustomCommandInput[] =
    dbGuild?.customCommands.map((command) => ({
      id: command.id,
      name: command.name,
      description: command.description,
      responseText: command.responseText ?? "",
      cooldownSeconds: command.cooldownSeconds,
      allowedRoleIds: command.allowedRoleIds,
      allowedChannelIds: command.allowedChannelIds,
      enabled: command.enabled
    })) ?? [];
  const logConfigMap = new Map(
    (dbGuild?.logConfigs ?? []).map((config) => [config.event as GuildLogEvent, config])
  );
  const loggingConfigs = logEvents.map((event) => {
    const config = logConfigMap.get(event);

    return {
      event,
      enabled: config?.enabled ?? false,
      channelId: config?.channelId ?? null
    };
  });
  const reactionRolePanels: ReactionRolePanelInput[] =
    dbGuild?.reactionRolePanels.map((panel) =>
      reactionRolePanelInputSchema.parse({
        id: panel.id,
        channelId: panel.channelId,
        title: panel.title,
        description: panel.description,
        color: panel.color,
        mode: panel.mode,
        enabled: panel.enabled,
        options: panel.options.map((option) => ({
          id: option.id,
          type: option.type,
          roleId: option.roleId,
          emoji: option.emoji,
          label: option.label,
          sortOrder: option.sortOrder
        }))
      })
    ) ?? [];
  const giveaways: DashboardGiveawayInput[] =
    dbGuild?.giveaways.map((giveaway) => ({
      id: giveaway.id,
      channelId: giveaway.channelId,
      prize: giveaway.prize,
      winnerCount: giveaway.winnerCount,
      requiredRoleId: giveaway.requiredRoleId,
      endsAt: giveaway.endsAt.toISOString()
    })) ?? [];
  const polls: DashboardPollInput[] =
    dbGuild?.polls.map((poll) => ({
      id: poll.id,
      channelId: poll.channelId,
      question: poll.question,
      visibility: poll.visibility as DashboardPollInput["visibility"],
      endsAt: poll.endsAt?.toISOString() ?? null,
      options: poll.options.map((option) => option.label)
    })) ?? [];
  const socialAlerts: SocialAlertInput[] =
    dbGuild?.socialAlerts.map((alert) =>
      socialAlertInputSchema.parse({
        id: alert.id,
        type: alert.type,
        sourceId: alert.sourceId,
        sourceUrl: alert.sourceUrl,
        channelId: alert.channelId,
        messageTemplate: alert.messageTemplate,
        intervalSeconds: alert.intervalSeconds,
        enabled: alert.enabled
      })
    ) ?? [];
  const economyShopItems: EconomyShopItemInput[] =
    dbGuild?.economyShopItems.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      type: item.type,
      price: item.price,
      roleId: item.roleId,
      stock: item.stock,
      soldCount: item.soldCount,
      perUserLimit: item.perUserLimit,
      status: item.status
    })) ?? [];

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Button asChild variant="ghost" size="icon">
              <Link href="/guilds" aria-label="返回伺服器列表">
                <ArrowLeft size={18} aria-hidden="true" />
              </Link>
            </Button>
            {guild.iconUrl ? (
              <Image
                src={guild.iconUrl}
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 rounded-md bg-muted object-cover"
                unoptimized={guild.iconUrl.includes(".gif")}
              />
            ) : null}
            <div className="min-w-0">
              <p className="text-sm font-medium text-primary">伺服器總覽</p>
              <h1 className="truncate text-2xl font-semibold">{guild.name}</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant={guild.botJoined ? "default" : "warning"}>
              {guild.botJoined ? "機器人已連線" : "尚未安裝機器人"}
            </Badge>
            <SignOutButton />
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>成員</CardTitle>
              <CardDescription>目前已知的伺服器成員數。</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {guild.memberCount?.toLocaleString("zh-TW") ?? "-"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>功能模組</CardTitle>
              <CardDescription>目前已啟用的模組數量。</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {modules.filter((module) => module.enabled).length}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>稽核事件</CardTitle>
              <CardDescription>近期管理面板與機器人紀錄。</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {dbGuild?.auditLogs.length ?? 0}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck size={18} aria-hidden="true" />
                功能模組
              </CardTitle>
              <CardDescription>啟用或停用各項伺服器功能。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <ModuleToggleForm guildId={params.guildId} modules={modules} />
              <div className="grid gap-3 md:grid-cols-2">
                {modules.map((module) => (
                  <div
                    key={module.module}
                    className="rounded-md border border-border p-4 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{moduleLabels[module.module]}</p>
                      <Badge variant={module.enabled ? "default" : "secondary"}>
                        {module.enabled ? "已啟用" : "已停用"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm leading-5 text-muted-foreground">
                      {moduleDescriptions[module.module]}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity size={18} aria-hidden="true" />
                最近活動
              </CardTitle>
              <CardDescription>此伺服器最新的稽核紀錄。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(dbGuild?.auditLogs ?? []).length > 0 ? (
                dbGuild?.auditLogs.map((log) => (
                  <div key={log.id} className="rounded-md border border-border p-3">
                    <p className="text-sm font-medium">{formatAuditAction(log.action)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {log.createdAt.toLocaleString("zh-TW")}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">目前尚無稽核紀錄。</p>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>管理功能</CardTitle>
              <CardDescription>設定管理身分組、靜音身分組、紀錄頻道與預設值。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <ModerationSettingsForm guildId={params.guildId} settings={moderationSettings} />
              <div className="space-y-3">
                <p className="text-sm font-medium">最近警告</p>
                {(dbGuild?.warnings ?? []).length > 0 ? (
                  dbGuild?.warnings.map((warning) => (
                    <div key={warning.id} className="rounded-md border border-border p-3 text-sm">
                      <p className="font-medium">
                        <span className="text-muted-foreground">對象：</span> {warning.targetUserId}
                      </p>
                      <p className="mt-1 text-muted-foreground">{warning.reason}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">目前尚無警告紀錄。</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>歡迎與離開訊息</CardTitle>
              <CardDescription>設定加入與離開訊息、自動身分組及預覽。</CardDescription>
            </CardHeader>
            <CardContent>
              <WelcomeSettingsForm
                guildId={params.guildId}
                guildName={guild.name}
                memberCount={guild.memberCount}
                settings={welcomeSettings}
              />
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>貨幣與商店</CardTitle>
              <CardDescription>設定貨幣獎勵、每日簽到、成員轉帳與升級獎勵。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <EconomySettingsForm guildId={params.guildId} settings={economySettings} />
              <div className="grid gap-4 border-t border-border pt-6 lg:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-sm font-medium">餘額排行榜</p>
                  {(dbGuild?.economyAccounts ?? []).length > 0 ? (
                    dbGuild?.economyAccounts.map((account, index) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm"
                      >
                        <p className="min-w-0 truncate font-medium">
                          #{index + 1} {account.userId}
                        </p>
                        <p className="shrink-0 text-muted-foreground">
                          {account.balance.toLocaleString("zh-TW")} {economySettings.currencySymbol}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">目前尚無貨幣帳戶。</p>
                  )}
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-medium">最近交易</p>
                  {(dbGuild?.economyTransactions ?? []).length > 0 ? (
                    dbGuild?.economyTransactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {economyTransactionLabels[transaction.type] ?? transaction.type}
                          </p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {transaction.userId} · {transaction.createdAt.toLocaleString("zh-TW")}
                          </p>
                        </div>
                        <p
                          className={
                            transaction.amount >= 0
                              ? "shrink-0 font-medium text-primary"
                              : "shrink-0 font-medium text-destructive"
                          }
                        >
                          {transaction.amount >= 0 ? "+" : ""}
                          {transaction.amount.toLocaleString("zh-TW")}{" "}
                          {economySettings.currencySymbol}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">目前尚無交易紀錄。</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>商店管理</CardTitle>
              <CardDescription>
                建立身分組與收藏品商品；已出售商品會保留類型與交易歷史。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EconomyShopForm guildId={params.guildId} items={economyShopItems} />
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>伺服器紀錄</CardTitle>
              <CardDescription>將各種伺服器事件傳送至指定的 Discord 頻道。</CardDescription>
            </CardHeader>
            <CardContent>
              <LoggingSettingsForm guildId={params.guildId} configs={loggingConfigs} />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>等級與經驗值</CardTitle>
              <CardDescription>設定經驗值、冷卻時間、升級訊息與身分組獎勵。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <LevelingSettingsForm
                guildId={params.guildId}
                settings={levelingSettings}
                rewards={levelRewards}
              />
              <div className="space-y-3">
                <p className="text-sm font-medium">排行榜預覽</p>
                {(dbGuild?.levelingUsers ?? []).length > 0 ? (
                  dbGuild?.levelingUsers.map((user, index) => (
                    <div key={user.id} className="rounded-md border border-border p-3 text-sm">
                      <p className="font-medium">
                        #{index + 1} {user.userId}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        等級 {user.level}，{user.xp.toLocaleString("zh-TW")} 經驗值
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">目前尚無經驗值紀錄。</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>自動管理</CardTitle>
              <CardDescription>設定過濾規則、忽略對象與自動處罰。</CardDescription>
            </CardHeader>
            <CardContent>
              <AutoModSettingsForm guildId={params.guildId} rules={autoModRules} />
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>自訂指令</CardTitle>
              <CardDescription>設定前綴指令回覆、冷卻時間與使用權限。</CardDescription>
            </CardHeader>
            <CardContent>
              <CustomCommandsForm
                guildId={params.guildId}
                commandPrefix={dbGuild?.config?.commandPrefix ?? "!"}
                commands={customCommands}
              />
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>自助身分組</CardTitle>
              <CardDescription>建立按鈕或表情反應面板，讓成員自行領取身分組。</CardDescription>
            </CardHeader>
            <CardContent>
              <ReactionRolesForm guildId={params.guildId} panels={reactionRolePanels} />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>抽獎</CardTitle>
              <CardDescription>管理獎品、得獎人數、身分組限制與結束時間。</CardDescription>
            </CardHeader>
            <CardContent>
              <GiveawaysForm guildId={params.guildId} giveaways={giveaways} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>投票</CardTitle>
              <CardDescription>設定按鈕投票與公開或匿名結果。</CardDescription>
            </CardHeader>
            <CardContent>
              <PollsForm guildId={params.guildId} polls={polls} />
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>社群通知</CardTitle>
              <CardDescription>將 YouTube、Twitch 與 RSS 更新通知傳送至 Discord。</CardDescription>
            </CardHeader>
            <CardContent>
              <SocialAlertsForm guildId={params.guildId} alerts={socialAlerts} />
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
