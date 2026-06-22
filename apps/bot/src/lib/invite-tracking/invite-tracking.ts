import type { Guild, GuildMember } from "discord.js";

import { formatTemplate, inviteTrackingSettingsSchema } from "@guildforge/shared";

import type { CommandContext } from "../../commands/types";
import { isSendableGuildTextChannel } from "../channels";
import { getGuildModuleSettings } from "../modules";

const inviteSnapshots = new Map<string, Map<string, number>>();

export async function refreshGuildInviteSnapshot(guild: Guild, context: CommandContext) {
  const invites = await guild.invites.fetch().catch((error) => {
    context.logger.warn("Unable to fetch guild invites", {
      guildId: guild.id,
      error
    });
    return null;
  });

  if (!invites) {
    return;
  }

  inviteSnapshots.set(guild.id, new Map(invites.map((invite) => [invite.code, invite.uses ?? 0])));
}

async function getSettings(context: CommandContext, guildId: string) {
  const config = await getGuildModuleSettings(context.prisma, guildId, "INVITE_TRACKING");
  return {
    enabled: config.enabled,
    settings: inviteTrackingSettingsSchema.parse(config.settings ?? {})
  };
}

export async function trackMemberInvite(member: GuildMember, context: CommandContext) {
  const { enabled, settings } = await getSettings(context, member.guild.id);

  if (!enabled || (member.user.bot && !settings.trackBots)) {
    return;
  }

  const previous = inviteSnapshots.get(member.guild.id) ?? new Map<string, number>();
  const invites = await member.guild.invites.fetch().catch(() => null);

  if (!invites) {
    return;
  }

  const usedInvite = invites.find(
    (invite) => (invite.uses ?? 0) > (previous.get(invite.code) ?? 0)
  );
  inviteSnapshots.set(
    member.guild.id,
    new Map(invites.map((invite) => [invite.code, invite.uses ?? 0]))
  );
  const inviterUserId = usedInvite?.inviter?.id ?? null;

  await context.prisma.inviteAttribution.upsert({
    where: {
      guildId_memberUserId: {
        guildId: member.guild.id,
        memberUserId: member.id
      }
    },
    create: {
      guildId: member.guild.id,
      memberUserId: member.id,
      inviterUserId,
      inviteCode: usedInvite?.code ?? null
    },
    update: {
      inviterUserId,
      inviteCode: usedInvite?.code ?? null,
      joinedAt: new Date()
    }
  });

  if (!settings.announcementChannelId) {
    return;
  }

  const channel = await member.guild.channels
    .fetch(settings.announcementChannelId)
    .catch(() => null);

  if (!isSendableGuildTextChannel(channel)) {
    return;
  }

  const count = inviterUserId
    ? await context.prisma.inviteAttribution.count({
        where: {
          guildId: member.guild.id,
          inviterUserId
        }
      })
    : 0;
  const content = formatTemplate(settings.announcementMessage, {
    member: `<@${member.id}>`,
    inviter: inviterUserId ? `<@${inviterUserId}>` : "未知邀請",
    count,
    server: member.guild.name
  });

  await channel.send({
    content,
    allowedMentions: {
      users: [member.id, ...(inviterUserId ? [inviterUserId] : [])]
    }
  });
}
