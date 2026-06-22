import { PermissionFlagsBits, type Guild } from "discord.js";

import {
  MembershipEntitlementStatus,
  type MembershipEntitlement
} from "@guildforge/database";
import {
  membershipSettingsSchema,
  type MembershipPlanInput,
  type MembershipSettings
} from "@guildforge/shared";

import type { CommandContext } from "../../commands/types";
import { isSendableGuildTextChannel } from "../channels";

export function entitlementShouldBeActive(
  entitlement: Pick<MembershipEntitlement, "status" | "expiresAt">,
  gracePeriodDays: number,
  now = new Date()
) {
  if (entitlement.status === MembershipEntitlementStatus.ACTIVE) {
    return !entitlement.expiresAt || entitlement.expiresAt > now;
  }

  if (
    entitlement.status === MembershipEntitlementStatus.PAST_DUE &&
    entitlement.expiresAt
  ) {
    return (
      entitlement.expiresAt.getTime() + gracePeriodDays * 24 * 60 * 60 * 1_000 >
      now.getTime()
    );
  }

  return false;
}

async function ensurePrivateChannelAccess(
  guild: Guild,
  plan: MembershipPlanInput,
  context: CommandContext
) {
  for (const channelId of plan.privateChannelIds) {
    const channel = await guild.channels.fetch(channelId).catch(() => null);

    if (!channel || !("permissionOverwrites" in channel)) {
      continue;
    }

    await channel.permissionOverwrites
      .edit(
        guild.roles.everyone.id,
        {
          ViewChannel: false
        },
        {
          reason: `Hydrava membership private channel for ${plan.name}`
        }
      )
      .catch((error) => {
        context.logger.warn("Failed to make membership channel private", {
          guildId: guild.id,
          planKey: plan.key,
          channelId,
          error
        });
      });
    await channel.permissionOverwrites
      .edit(
        plan.roleId,
        {
          ViewChannel: true
        },
        {
          reason: `Hydrava membership plan ${plan.name}`
        }
      )
      .catch((error) => {
        context.logger.warn("Failed to grant membership role private channel access", {
          guildId: guild.id,
          planKey: plan.key,
          channelId,
          error
        });
      });
  }
}

async function announceMembership(
  guild: Guild,
  settings: MembershipSettings,
  userId: string,
  plan: MembershipPlanInput
) {
  if (!settings.announcementChannelId) {
    return;
  }

  const channel = await guild.channels.fetch(settings.announcementChannelId).catch(() => null);

  if (!isSendableGuildTextChannel(channel)) {
    return;
  }

  await channel
    .send({
      content: `✨ <@${userId}> 已取得 **${plan.name}** 會員資格！`,
      allowedMentions: {
        users: [userId]
      }
    })
    .catch(() => null);
}

async function syncEntitlement(
  guild: Guild,
  settings: MembershipSettings,
  plan: MembershipPlanInput,
  entitlement: MembershipEntitlement,
  context: CommandContext
) {
  const member = await guild.members.fetch(entitlement.userId).catch(() => null);

  if (!member) {
    await context.prisma.membershipEntitlement.update({
      where: { id: entitlement.id },
      data: {
        lastSyncedAt: new Date(),
        lastError: "Discord member not found"
      }
    });
    return;
  }

  const shouldBeActive = entitlementShouldBeActive(
    entitlement,
    settings.gracePeriodDays
  );
  const hasRole = member.roles.cache.has(plan.roleId);

  try {
    if (shouldBeActive && !hasRole) {
      await member.roles.add(plan.roleId, `Hydrava membership plan ${plan.name}`);
      await announceMembership(guild, settings, entitlement.userId, plan);
    } else if (!shouldBeActive && hasRole && settings.removeRoleOnExpiry) {
      await member.roles.remove(plan.roleId, `Hydrava membership plan ${plan.name} expired`);
    }

    await context.prisma.membershipEntitlement.update({
      where: { id: entitlement.id },
      data: {
        lastSyncedAt: new Date(),
        roleAppliedAt: shouldBeActive ? new Date() : null,
        lastError: null
      }
    });
  } catch (error) {
    await context.prisma.membershipEntitlement.update({
      where: { id: entitlement.id },
      data: {
        lastSyncedAt: new Date(),
        lastError: error instanceof Error ? error.message.slice(0, 1_000) : "Unknown Discord error"
      }
    });
  }
}

export async function syncGuildMemberships(
  guildId: string,
  context: CommandContext
) {
  const moduleConfig = await context.prisma.moduleConfig.findUnique({
    where: {
      guildId_module: {
        guildId,
        module: "MEMBERSHIPS"
      }
    },
    select: {
      enabled: true,
      settings: true
    }
  });

  if (!moduleConfig?.enabled) {
    return;
  }

  const guild = context.client.guilds.cache.get(guildId);

  if (!guild) {
    return;
  }

  const settings = membershipSettingsSchema.parse(moduleConfig.settings ?? {});
  const planMap = new Map(settings.plans.filter((plan) => plan.enabled).map((plan) => [plan.key, plan]));

  for (const plan of planMap.values()) {
    await ensurePrivateChannelAccess(guild, plan, context);
  }

  const entitlements = await context.prisma.membershipEntitlement.findMany({
    where: {
      guildId
    }
  });

  for (const entitlement of entitlements) {
    const plan = planMap.get(entitlement.planKey);

    if (!plan) {
      continue;
    }

    await syncEntitlement(guild, settings, plan, entitlement, context);
  }
}

export async function syncMembershipEntitlements(context: CommandContext) {
  const configs = await context.prisma.moduleConfig.findMany({
    where: {
      module: "MEMBERSHIPS",
      enabled: true
    },
    select: {
      guildId: true
    }
  });

  for (const config of configs) {
    await syncGuildMemberships(config.guildId, context);
  }
}

export const membershipPermission = PermissionFlagsBits.ManageGuild;
