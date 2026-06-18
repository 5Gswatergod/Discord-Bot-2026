import { ArrowLeft, Activity, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import {
  autoModRuleInputSchema,
  autoModTriggers,
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
  type GuildLogEvent,
  type GuildModuleKey,
  type ReactionRolePanelInput,
  type SocialAlertInput
} from "@guildforge/shared";

import { SignOutButton } from "@/components/auth-button";
import { AutoModSettingsForm } from "@/components/settings/automod-settings-form";
import { CustomCommandsForm } from "@/components/settings/custom-commands-form";
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
  const levelRewards =
    dbGuild?.levelRewards.map((reward) => ({
      level: reward.level,
      roleId: reward.roleId,
      stackable: reward.stackable
    })) ?? [];
  const autoModRuleMap = new Map(
    (dbGuild?.autoModRules ?? []).map((rule) => [rule.trigger, rule])
  );
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

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Button asChild variant="ghost" size="icon">
              <Link href="/guilds" aria-label="Back to servers">
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
              <p className="text-sm font-medium text-primary">Server Overview</p>
              <h1 className="truncate text-2xl font-semibold">{guild.name}</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant={guild.botJoined ? "default" : "warning"}>
              {guild.botJoined ? "Bot connected" : "Bot not installed"}
            </Badge>
            <SignOutButton />
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Members</CardTitle>
              <CardDescription>Current known server size.</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {guild.memberCount?.toLocaleString() ?? "-"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Modules</CardTitle>
              <CardDescription>Enabled module count.</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {modules.filter((module) => module.enabled).length}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Audit Events</CardTitle>
              <CardDescription>Recent dashboard and bot records.</CardDescription>
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
                Modules
              </CardTitle>
              <CardDescription>Enable or disable each guild module.</CardDescription>
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
                        {module.enabled ? "Enabled" : "Disabled"}
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
                Recent Activity
              </CardTitle>
              <CardDescription>Latest guild-scoped audit entries.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(dbGuild?.auditLogs ?? []).length > 0 ? (
                dbGuild?.auditLogs.map((log) => (
                  <div key={log.id} className="rounded-md border border-border p-3">
                    <p className="text-sm font-medium">{log.action}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {log.createdAt.toLocaleString()}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No audit entries yet.</p>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Moderation</CardTitle>
              <CardDescription>Role access, mute role, log channel, and defaults.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <ModerationSettingsForm guildId={params.guildId} settings={moderationSettings} />
              <div className="space-y-3">
                <p className="text-sm font-medium">Recent warnings</p>
                {(dbGuild?.warnings ?? []).length > 0 ? (
                  dbGuild?.warnings.map((warning) => (
                    <div key={warning.id} className="rounded-md border border-border p-3 text-sm">
                      <p className="font-medium">
                        <span className="text-muted-foreground">Target:</span>{" "}
                        {warning.targetUserId}
                      </p>
                      <p className="mt-1 text-muted-foreground">{warning.reason}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No warnings recorded.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Welcome</CardTitle>
              <CardDescription>Join and leave messages, auto role, and preview.</CardDescription>
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
              <CardTitle>Logging</CardTitle>
              <CardDescription>Route each guild event to a Discord channel.</CardDescription>
            </CardHeader>
            <CardContent>
              <LoggingSettingsForm guildId={params.guildId} configs={loggingConfigs} />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Leveling</CardTitle>
              <CardDescription>XP rewards, cooldowns, level messages, and role rewards.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <LevelingSettingsForm
                guildId={params.guildId}
                settings={levelingSettings}
                rewards={levelRewards}
              />
              <div className="space-y-3">
                <p className="text-sm font-medium">Leaderboard preview</p>
                {(dbGuild?.levelingUsers ?? []).length > 0 ? (
                  dbGuild?.levelingUsers.map((user, index) => (
                    <div key={user.id} className="rounded-md border border-border p-3 text-sm">
                      <p className="font-medium">
                        #{index + 1} {user.userId}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        Level {user.level}, {user.xp.toLocaleString()} XP
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No XP records yet.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Auto Moderation</CardTitle>
              <CardDescription>Filters, ignored targets, and automated punishments.</CardDescription>
            </CardHeader>
            <CardContent>
              <AutoModSettingsForm guildId={params.guildId} rules={autoModRules} />
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>Custom Commands</CardTitle>
              <CardDescription>Prefix command responses with cooldowns and access rules.</CardDescription>
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
              <CardTitle>Reaction Roles</CardTitle>
              <CardDescription>Build button and reaction panels for role assignment.</CardDescription>
            </CardHeader>
            <CardContent>
              <ReactionRolesForm guildId={params.guildId} panels={reactionRolePanels} />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Giveaways</CardTitle>
              <CardDescription>Manage prize, winner count, role gate, and end time.</CardDescription>
            </CardHeader>
            <CardContent>
              <GiveawaysForm guildId={params.guildId} giveaways={giveaways} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Polls</CardTitle>
              <CardDescription>Configure button polls with public or anonymous results.</CardDescription>
            </CardHeader>
            <CardContent>
              <PollsForm guildId={params.guildId} polls={polls} />
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>Social Alerts</CardTitle>
              <CardDescription>YouTube, Twitch, and RSS notifications routed to Discord.</CardDescription>
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
