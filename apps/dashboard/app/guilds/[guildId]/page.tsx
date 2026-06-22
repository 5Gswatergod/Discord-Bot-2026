import {
  aiAssistantSettingsSchema,
  achievementSettingsSchema,
  automationRuleInputSchema,
  automationTriggerLabels,
  autoModRuleInputSchema,
  autoModTriggers,
  birthdaySettingsSchema,
  economySettingsSchema,
  embedMessageInputSchema,
  inviteTrackingSettingsSchema,
  logEvents,
  levelingSettingsSchema,
  membershipSettingsSchema,
  moduleKeys,
  moderationSettingsSchema,
  reactionRolePanelInputSchema,
  serverStatChannelInputSchema,
  socialAlertInputSchema,
  starboardSettingsSchema,
  ticketSettingsSchema,
  temporaryVoiceSettingsSchema,
  web3SettingsSchema,
  welcomeSettingsSchema,
  type AiAssistantSettings,
  type AchievementSettings,
  type AutomationRuleInput,
  type AutoModRuleInput,
  type BirthdaySettings,
  type CustomCommandInput,
  type EconomyShopItemInput,
  type EmbedMessageInput,
  type GuildLogEvent,
  type GuildModuleKey,
  type InviteTrackingSettings,
  type MembershipSettings,
  type ReactionRolePanelInput,
  type ServerStatChannelInput,
  type StarboardSettings,
  type TicketSettings,
  type TemporaryVoiceSettings,
  type Web3Settings
} from "@guildforge/shared";

import { GuildDashboardShell } from "@/components/guilds/guild-dashboard-shell";
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
import {
  SocialAlertsForm,
  type DashboardSocialAlertInput
} from "@/components/settings/social-alerts-form";
import { WelcomeSettingsForm } from "@/components/settings/welcome-settings-form";
import { TicketSettingsForm } from "@/components/settings/ticket-settings-form";
import {
  InviteTrackingForm,
  type InviteLeaderboardEntry
} from "@/components/settings/invite-tracking-form";
import { EmbedMessagesForm } from "@/components/settings/embed-messages-form";
import { RemindersForm, type DashboardReminderInput } from "@/components/settings/reminders-form";
import { AchievementsForm } from "@/components/settings/achievements-form";
import {
  BirthdaySettingsForm,
  type DashboardBirthday
} from "@/components/settings/birthday-settings-form";
import { ServerStatsForm } from "@/components/settings/server-stats-form";
import { StarboardSettingsForm } from "@/components/settings/starboard-settings-form";
import { TemporaryVoiceForm } from "@/components/settings/temporary-voice-form";
import { AutomationsForm } from "@/components/settings/automations-form";
import { AiAssistantForm } from "@/components/settings/ai-assistant-form";
import {
  MembershipsForm,
  type DashboardMembershipEntitlement
} from "@/components/settings/memberships-form";
import {
  Web3SettingsForm,
  type DashboardWeb3Wallet
} from "@/components/settings/web3-settings-form";
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
  DASHBOARD_TICKET_SETTINGS_UPDATE: "更新客服單設定",
  DASHBOARD_INVITE_TRACKING_UPDATE: "更新邀請追蹤設定",
  DASHBOARD_EMBED_MESSAGES_UPDATE: "更新嵌入訊息",
  DASHBOARD_REMINDERS_UPDATE: "更新提醒排程",
  DASHBOARD_STARBOARD_UPDATE: "更新熱門訊息牆",
  DASHBOARD_ACHIEVEMENTS_UPDATE: "更新成就與獎勵",
  DASHBOARD_BIRTHDAYS_UPDATE: "更新生日祝福",
  DASHBOARD_SERVER_STATS_UPDATE: "更新伺服器統計頻道",
  DASHBOARD_TEMPORARY_VOICE_UPDATE: "更新臨時語音頻道",
  DASHBOARD_AUTOMATIONS_UPDATE: "更新進階自動化",
  DASHBOARD_AI_ASSISTANT_UPDATE: "更新 Hydrava AI 助理",
  DASHBOARD_MEMBERSHIPS_UPDATE: "更新付費會員",
  DASHBOARD_WEB3_UPDATE: "更新 NFT／Web3 驗證",
  TICKET_CLOSED: "關閉客服單",
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
        where: {
          deletedAt: null
        },
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
        include: {
          _count: {
            select: {
              deliveries: {
                where: {
                  status: "SENT"
                }
              }
            }
          }
        },
        orderBy: {
          updatedAt: "desc"
        }
      },
      warnings: {
        take: 5,
        orderBy: {
          createdAt: "desc"
        }
      },
      tickets: {
        take: 10,
        orderBy: {
          createdAt: "desc"
        }
      },
      inviteAttributions: {
        take: 5_000,
        orderBy: {
          joinedAt: "desc"
        }
      },
      embedMessages: {
        orderBy: {
          createdAt: "asc"
        }
      },
      reminders: {
        orderBy: {
          nextRunAt: "asc"
        }
      },
      starboardEntries: {
        take: 10,
        orderBy: {
          starCount: "desc"
        }
      },
      achievements: {
        orderBy: {
          createdAt: "asc"
        }
      },
      achievementAwards: {
        take: 10,
        include: {
          achievement: true
        },
        orderBy: {
          awardedAt: "desc"
        }
      },
      birthdays: {
        orderBy: [
          {
            month: "asc"
          },
          {
            day: "asc"
          }
        ]
      },
      serverStatChannels: {
        orderBy: {
          createdAt: "asc"
        }
      },
      temporaryVoice: {
        orderBy: {
          createdAt: "desc"
        }
      },
      automationRules: {
        orderBy: [
          {
            position: "asc"
          },
          {
            createdAt: "asc"
          }
        ]
      },
      automationExecutions: {
        take: 30,
        include: {
          rule: {
            select: {
              name: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      },
      aiAssistantRequests: {
        take: 500,
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000)
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      },
      membershipEntitlements: {
        take: 50,
        orderBy: {
          updatedAt: "desc"
        }
      },
      web3Wallets: {
        take: 50,
        include: {
          verifications: true
        },
        orderBy: {
          updatedAt: "desc"
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
  const ticketSettings: TicketSettings = ticketSettingsSchema.parse(
    moduleConfigMap.get("TICKETS")?.settings ?? {}
  );
  const inviteTrackingSettings: InviteTrackingSettings = inviteTrackingSettingsSchema.parse(
    moduleConfigMap.get("INVITE_TRACKING")?.settings ?? {}
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
        publishedChannelId: panel.publishedChannelId,
        messageId: panel.messageId,
        title: panel.title,
        description: panel.description,
        color: panel.color,
        mode: panel.mode,
        enabled: panel.enabled,
        lastSyncedAt: panel.lastSyncedAt?.toISOString() ?? null,
        lastSyncError: panel.lastSyncError,
        syncPending:
          Boolean(panel.lastSyncError) ||
          (panel.enabled ? !panel.lastSyncedAt : Boolean(panel.messageId)),
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
  const socialAlerts: DashboardSocialAlertInput[] =
    dbGuild?.socialAlerts.map((alert) => ({
      ...socialAlertInputSchema.parse({
        id: alert.id,
        type: alert.type,
        sourceId: alert.sourceId,
        sourceUrl: alert.sourceUrl,
        channelId: alert.channelId,
        mentionRoleId: alert.mentionRoleId,
        mentionEveryone: alert.mentionEveryone,
        messageTemplate: alert.messageTemplate,
        intervalSeconds: alert.intervalSeconds,
        maxItemsPerCheck: alert.maxItemsPerCheck,
        maxNotificationsPerHour: alert.maxNotificationsPerHour,
        enabled: alert.enabled
      }),
      consecutiveFailures: alert.consecutiveFailures,
      lastError: alert.lastError,
      lastErrorAt: alert.lastErrorAt?.toISOString() ?? null,
      lastSuccessAt: alert.lastSuccessAt?.toISOString() ?? null,
      nextCheckAt: alert.nextCheckAt.toISOString(),
      sentCount: alert._count.deliveries
    })) ?? [];
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
  const embedMessages: EmbedMessageInput[] =
    dbGuild?.embedMessages.map((message) =>
      embedMessageInputSchema.parse({
        id: message.id,
        channelId: message.channelId,
        content: message.content,
        title: message.title,
        description: message.description,
        color: message.color,
        url: message.url,
        imageUrl: message.imageUrl,
        thumbnailUrl: message.thumbnailUrl,
        footerText: message.footerText,
        authorName: message.authorName,
        enabled: message.enabled
      })
    ) ?? [];
  const reminders: DashboardReminderInput[] =
    dbGuild?.reminders.map((reminder) => ({
      id: reminder.id,
      channelId: reminder.channelId,
      message: reminder.message,
      nextRunAt: reminder.nextRunAt.toISOString(),
      intervalSeconds: reminder.intervalSeconds,
      enabled: reminder.enabled
    })) ?? [];
  const starboardSettings: StarboardSettings = starboardSettingsSchema.parse(
    moduleConfigMap.get("STARBOARD")?.settings ?? {}
  );
  const achievementModuleSettings = achievementSettingsSchema.parse(
    moduleConfigMap.get("ACHIEVEMENTS")?.settings ?? {}
  );
  const achievementSettings: AchievementSettings = {
    ...achievementModuleSettings,
    achievements:
      dbGuild?.achievements.map((achievement) => ({
        id: achievement.id,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        trigger: achievement.trigger,
        threshold: achievement.threshold,
        rewardRoleId: achievement.rewardRoleId,
        enabled: achievement.enabled
      })) ?? []
  };
  const birthdaySettings: BirthdaySettings = birthdaySettingsSchema.parse(
    moduleConfigMap.get("BIRTHDAYS")?.settings ?? {}
  );
  const birthdays: DashboardBirthday[] =
    dbGuild?.birthdays.map((birthday) => ({
      userId: birthday.userId,
      month: birthday.month,
      day: birthday.day,
      year: birthday.year
    })) ?? [];
  const serverStatChannels: ServerStatChannelInput[] =
    dbGuild?.serverStatChannels.map((channel) =>
      serverStatChannelInputSchema.parse({
        id: channel.id,
        type: channel.type,
        template: channel.template,
        categoryId: channel.categoryId,
        enabled: channel.enabled
      })
    ) ?? [];
  const temporaryVoiceSettings: TemporaryVoiceSettings = temporaryVoiceSettingsSchema.parse(
    moduleConfigMap.get("TEMPORARY_VOICE")?.settings ?? {}
  );
  const automationRules: AutomationRuleInput[] =
    dbGuild?.automationRules.map((rule) =>
      automationRuleInputSchema.parse({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        trigger: rule.trigger,
        triggerConfig: rule.triggerConfig ?? {},
        conditions: rule.conditions,
        actions: rule.actions,
        position: rule.position,
        enabled: rule.enabled,
        stopProcessing: rule.stopProcessing,
        cooldownSeconds: rule.cooldownSeconds
      })
    ) ?? [];
  const aiAssistantSettings: AiAssistantSettings = aiAssistantSettingsSchema.parse(
    moduleConfigMap.get("AI_ASSISTANT")?.settings ?? {}
  );
  const membershipSettings: MembershipSettings = membershipSettingsSchema.parse(
    moduleConfigMap.get("MEMBERSHIPS")?.settings ?? {}
  );
  const membershipEntitlements: DashboardMembershipEntitlement[] =
    dbGuild?.membershipEntitlements.map((entitlement) => ({
      id: entitlement.id,
      userId: entitlement.userId,
      planKey: entitlement.planKey,
      status: entitlement.status,
      expiresAt: entitlement.expiresAt?.toISOString() ?? null,
      lastError: entitlement.lastError
    })) ?? [];
  const web3Settings: Web3Settings = web3SettingsSchema.parse(
    moduleConfigMap.get("WEB3")?.settings ?? {}
  );
  const web3Wallets: DashboardWeb3Wallet[] =
    dbGuild?.web3Wallets.map((wallet) => ({
      id: wallet.id,
      userId: wallet.userId,
      address: wallet.address,
      verifiedAt: wallet.verifiedAt?.toISOString() ?? null,
      eligibleCount: wallet.verifications.filter((verification) => verification.eligible).length,
      errorCount: wallet.verifications.filter((verification) => Boolean(verification.error)).length
    })) ?? [];
  const aiRequestCount =
    dbGuild?.aiAssistantRequests.filter((request) => request.status === "SUCCESS").length ?? 0;
  const aiFailedCount =
    dbGuild?.aiAssistantRequests.filter((request) => request.status === "FAILED").length ?? 0;
  const inviteCountMap = new Map<string, number>();

  for (const attribution of dbGuild?.inviteAttributions ?? []) {
    if (attribution.inviterUserId) {
      inviteCountMap.set(
        attribution.inviterUserId,
        (inviteCountMap.get(attribution.inviterUserId) ?? 0) + 1
      );
    }
  }

  const inviteLeaderboard: InviteLeaderboardEntry[] = [...inviteCountMap.entries()]
    .map(([userId, count]) => ({ userId, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 10);

  return (
    <GuildDashboardShell
      guild={guild}
      enabledModuleCount={modules.filter((module) => module.enabled).length}
      auditCount={dbGuild?.auditLogs.length ?? 0}
    >
      <section id="modules" className="scroll-mt-28 space-y-4">
        <div>
          <p className="text-sm font-semibold text-primary">功能中心</p>
          <h2 className="mt-1 text-2xl font-bold">選擇要使用的功能</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            先啟用需要的模組，再從左側導覽進入詳細設定。
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>全部功能</CardTitle>
            <CardDescription>一鍵啟用或停用各項伺服器功能。</CardDescription>
          </CardHeader>
          <CardContent>
            <ModuleToggleForm guildId={params.guildId} modules={modules} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>最近活動</CardTitle>
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
        <Card id="moderation" className="scroll-mt-28">
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

        <Card id="welcome" className="scroll-mt-28">
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

      <section id="economy" className="scroll-mt-28">
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

      <section id="economy-shop" className="scroll-mt-28">
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

      <section id="logging" className="scroll-mt-28">
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
        <Card id="leveling" className="scroll-mt-28">
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

        <Card id="automod" className="scroll-mt-28">
          <CardHeader>
            <CardTitle>自動管理</CardTitle>
            <CardDescription>設定過濾規則、忽略對象與自動處罰。</CardDescription>
          </CardHeader>
          <CardContent>
            <AutoModSettingsForm guildId={params.guildId} rules={autoModRules} />
          </CardContent>
        </Card>
      </section>

      <section id="custom-commands" className="scroll-mt-28">
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

      <section id="reaction-roles" className="scroll-mt-28">
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
        <Card id="giveaways" className="scroll-mt-28">
          <CardHeader>
            <CardTitle>抽獎</CardTitle>
            <CardDescription>管理獎品、得獎人數、身分組限制與結束時間。</CardDescription>
          </CardHeader>
          <CardContent>
            <GiveawaysForm guildId={params.guildId} giveaways={giveaways} />
          </CardContent>
        </Card>

        <Card id="polls" className="scroll-mt-28">
          <CardHeader>
            <CardTitle>投票</CardTitle>
            <CardDescription>設定按鈕投票與公開或匿名結果。</CardDescription>
          </CardHeader>
          <CardContent>
            <PollsForm guildId={params.guildId} polls={polls} />
          </CardContent>
        </Card>
      </section>

      <section id="social-alerts" className="scroll-mt-28">
        <Card>
          <CardHeader>
            <CardTitle>社群通知</CardTitle>
            <CardDescription>
              集中管理影片、直播、社群貼文、Reddit、Podcast 與自訂 Feed 通知。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SocialAlertsForm guildId={params.guildId} alerts={socialAlerts} />
          </CardContent>
        </Card>
      </section>

      <section id="tickets" className="scroll-mt-28">
        <Card>
          <CardHeader>
            <CardTitle>客服單</CardTitle>
            <CardDescription>
              建立私人客服頻道、設定客服身分組，並由 Hydrava 自動同步開單面板。
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <TicketSettingsForm guildId={params.guildId} settings={ticketSettings} />
            <div className="border-t border-border pt-5">
              <p className="mb-3 text-sm font-medium">最近客服單</p>
              <div className="grid gap-2 md:grid-cols-2">
                {(dbGuild?.tickets ?? []).length > 0 ? (
                  dbGuild?.tickets.map((ticket) => (
                    <div key={ticket.id} className="rounded-md border border-border p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{ticket.ownerUserId}</span>
                        <span className="text-xs text-muted-foreground">
                          {ticket.status === "OPEN" ? "處理中" : "已關閉"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ticket.createdAt.toLocaleString("zh-TW")}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">目前尚無客服單。</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="invite-tracking" className="scroll-mt-28">
        <Card>
          <CardHeader>
            <CardTitle>邀請追蹤</CardTitle>
            <CardDescription>記錄新成員使用的邀請連結，並顯示邀請排行榜。</CardDescription>
          </CardHeader>
          <CardContent>
            <InviteTrackingForm
              guildId={params.guildId}
              settings={inviteTrackingSettings}
              leaderboard={inviteLeaderboard}
            />
          </CardContent>
        </Card>
      </section>

      <section id="embed-messages" className="scroll-mt-28">
        <Card>
          <CardHeader>
            <CardTitle>嵌入訊息編輯器</CardTitle>
            <CardDescription>
              視覺化建立公告、規則與資訊卡片，Hydrava 會自動發布及同步修改。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmbedMessagesForm guildId={params.guildId} messages={embedMessages} />
          </CardContent>
        </Card>
      </section>

      <section id="reminders" className="scroll-mt-28">
        <Card>
          <CardHeader>
            <CardTitle>提醒事項</CardTitle>
            <CardDescription>建立一次性或循環提醒，排程在指定頻道自動發送。</CardDescription>
          </CardHeader>
          <CardContent>
            <RemindersForm guildId={params.guildId} reminders={reminders} />
          </CardContent>
        </Card>
      </section>

      <section id="starboard" className="scroll-mt-28">
        <Card>
          <CardHeader>
            <CardTitle>Starboard 熱門訊息牆</CardTitle>
            <CardDescription>依照指定反應數量，自動把熱門訊息整理到精華頻道。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <StarboardSettingsForm guildId={params.guildId} settings={starboardSettings} />
            <div className="border-t border-border pt-5">
              <p className="mb-3 text-sm font-medium">目前熱門訊息</p>
              <div className="grid gap-2 md:grid-cols-2">
                {(dbGuild?.starboardEntries ?? []).length > 0 ? (
                  dbGuild?.starboardEntries.map((entry) => (
                    <div key={entry.id} className="rounded-md border border-border p-3 text-sm">
                      <p className="font-medium">{entry.starCount} 個反應</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        訊息 {entry.sourceMessageId}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">目前還沒有熱門訊息。</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="achievements" className="scroll-mt-28">
        <Card>
          <CardHeader>
            <CardTitle>成就與獎勵</CardTitle>
            <CardDescription>依訊息數、等級或邀請數解鎖成就，並可自動發放身分組。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <AchievementsForm guildId={params.guildId} settings={achievementSettings} />
            <div className="border-t border-border pt-5">
              <p className="mb-3 text-sm font-medium">最近解鎖</p>
              <div className="grid gap-2 md:grid-cols-2">
                {(dbGuild?.achievementAwards ?? []).length > 0 ? (
                  dbGuild?.achievementAwards.map((award) => (
                    <div key={award.id} className="rounded-md border border-border p-3 text-sm">
                      <p className="font-medium">
                        {award.achievement.icon ?? "🏆"} {award.achievement.name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {award.userId} · {award.awardedAt.toLocaleString("zh-TW")}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">目前還沒有成就解鎖紀錄。</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="birthdays" className="scroll-mt-28">
        <Card>
          <CardHeader>
            <CardTitle>生日紀錄與自動祝福</CardTitle>
            <CardDescription>
              成員可用指令登記生日，Hydrava 會依伺服器時區自動送上祝福。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BirthdaySettingsForm
              guildId={params.guildId}
              settings={birthdaySettings}
              birthdays={birthdays}
            />
          </CardContent>
        </Card>
      </section>

      <section id="server-stats" className="scroll-mt-28">
        <Card>
          <CardHeader>
            <CardTitle>伺服器統計頻道</CardTitle>
            <CardDescription>
              用不可加入的語音頻道即時顯示成員、Bot、身分組與頻道數量。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ServerStatsForm guildId={params.guildId} channels={serverStatChannels} />
          </CardContent>
        </Card>
      </section>

      <section id="temporary-voice" className="scroll-mt-28">
        <Card>
          <CardHeader>
            <CardTitle>臨時語音頻道</CardTitle>
            <CardDescription>
              成員加入大廳後自動建立私人語音頻道，無人時自動清除。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TemporaryVoiceForm
              guildId={params.guildId}
              settings={temporaryVoiceSettings}
              activeCount={dbGuild?.temporaryVoice.length ?? 0}
            />
          </CardContent>
        </Card>
      </section>

      <section id="automations" className="scroll-mt-28">
        <Card>
          <CardHeader>
            <CardTitle>進階自動化</CardTitle>
            <CardDescription>
              依訊息、反應、成員加入或身分組變化觸發條件與動作；規則會依畫面順序執行。
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-7">
            <AutomationsForm guildId={params.guildId} rules={automationRules} />
            <div className="border-t border-border pt-6">
              <p className="mb-3 text-sm font-semibold">最近執行紀錄</p>
              <div className="grid gap-2">
                {(dbGuild?.automationExecutions ?? []).length > 0 ? (
                  dbGuild?.automationExecutions.map((execution) => (
                    <div
                      key={execution.id}
                      className="grid gap-1 rounded-md border border-border p-3 text-sm md:grid-cols-[1fr_auto]"
                    >
                      <div>
                        <p className="font-medium">
                          {execution.rule?.name ?? "已刪除的規則"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {automationTriggerLabels[execution.trigger]} ·{" "}
                          {execution.createdAt.toLocaleString("zh-TW")}
                          {execution.durationMs !== null ? ` · ${execution.durationMs} ms` : ""}
                        </p>
                        {execution.error ? (
                          <p className="mt-1 text-xs text-destructive">{execution.error}</p>
                        ) : null}
                      </div>
                      <span className="self-start rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                        {execution.status === "SUCCESS"
                          ? "成功"
                          : execution.status === "FAILED"
                            ? "失敗"
                            : execution.status === "TEST"
                              ? "測試"
                              : "略過"}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">目前沒有執行紀錄。</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="ai-assistant" className="scroll-mt-28">
        <Card>
          <CardHeader>
            <CardTitle>Hydrava AI 人物與伺服器助理</CardTitle>
            <CardDescription>
              在指定頻道提供可自訂人格的 AI 回覆。模組停用或未設定伺服器端金鑰時不會產生 API 費用。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AiAssistantForm
              guildId={params.guildId}
              settings={aiAssistantSettings}
              requestCount={aiRequestCount}
              failedCount={aiFailedCount}
            />
          </CardContent>
        </Card>
      </section>

      <section id="memberships" className="scroll-mt-28">
        <Card>
          <CardHeader>
            <CardTitle>付費會員與訂閱權益</CardTitle>
            <CardDescription>
              使用簽章 webhook 或管理指令同步會員狀態，自動給予身分組並開放私人頻道。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MembershipsForm
              guildId={params.guildId}
              settings={membershipSettings}
              entitlements={membershipEntitlements}
            />
          </CardContent>
        </Card>
      </section>

      <section id="web3" className="scroll-mt-28">
        <Card>
          <CardHeader>
            <CardTitle>NFT／Web3 驗證與通知</CardTitle>
            <CardDescription>
              成員透過錢包簽章證明地址所有權，Hydrava 再從設定的 EVM RPC 驗證持有資格。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Web3SettingsForm
              guildId={params.guildId}
              settings={web3Settings}
              wallets={web3Wallets}
            />
          </CardContent>
        </Card>
      </section>
    </GuildDashboardShell>
  );
}
