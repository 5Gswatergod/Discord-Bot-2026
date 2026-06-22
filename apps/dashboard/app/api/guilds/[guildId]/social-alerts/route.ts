import { NextResponse } from "next/server";

import { ModuleKey, SocialAlertType } from "@guildforge/database";
import { buildSocialAlertSourceUrl, socialAlertsUpdateSchema } from "@guildforge/shared";

import { requireGuildApiAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: {
    guildId: string;
  };
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const access = await requireGuildApiAccess(params.guildId);

  if (!access.ok) {
    return access.response;
  }

  const parsed = socialAlertsUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "社群通知設定格式不正確" }, { status: 400 });
  }

  const input = parsed.data;
  const alertIds = [...new Set(input.alerts.map((alert) => alert.id).filter(Boolean))] as string[];

  if (alertIds.length > 0) {
    const ownedAlertCount = await prisma.socialAlert.count({
      where: {
        guildId: params.guildId,
        id: {
          in: alertIds
        }
      }
    });

    if (ownedAlertCount !== alertIds.length) {
      return NextResponse.json({ error: "找不到社群通知" }, { status: 404 });
    }
  }

  const existingAlerts =
    alertIds.length > 0
      ? await prisma.socialAlert.findMany({
          where: {
            guildId: params.guildId,
            id: { in: alertIds }
          },
          select: {
            id: true,
            type: true,
            sourceId: true,
            sourceUrl: true
          }
        })
      : [];
  const existingById = new Map(existingAlerts.map((alert) => [alert.id, alert]));

  await prisma.$transaction(async (tx) => {
    await tx.moduleConfig.upsert({
      where: {
        guildId_module: {
          guildId: params.guildId,
          module: ModuleKey.SOCIAL_ALERTS
        }
      },
      create: {
        guildId: params.guildId,
        module: ModuleKey.SOCIAL_ALERTS,
        enabled: true
      },
      update: {}
    });

    await tx.socialAlert.deleteMany({
      where: {
        guildId: params.guildId,
        id: {
          notIn: alertIds.length > 0 ? alertIds : ["__never__"]
        }
      }
    });

    for (const id of alertIds) {
      await tx.socialAlert.update({
        where: { id },
        data: {
          sourceId: `${"_".repeat(200)}hydrava_pending_${id}`
        }
      });
    }

    for (const alert of input.alerts) {
      const sourceUrl = buildSocialAlertSourceUrl(alert.type, alert.sourceId, alert.sourceUrl);
      const alertData = {
        type: alert.type as SocialAlertType,
        sourceId: alert.sourceId,
        sourceUrl,
        channelId: alert.channelId,
        mentionRoleId: alert.mentionRoleId,
        mentionEveryone: alert.mentionEveryone,
        messageTemplate: alert.messageTemplate,
        intervalSeconds: alert.intervalSeconds,
        maxItemsPerCheck: alert.maxItemsPerCheck,
        maxNotificationsPerHour: alert.maxNotificationsPerHour,
        enabled: alert.enabled
      };

      if (alert.id) {
        const existing = existingById.get(alert.id);
        const sourceChanged =
          existing?.type !== alert.type ||
          existing.sourceId !== alert.sourceId ||
          existing.sourceUrl !== sourceUrl;

        if (sourceChanged) {
          await tx.socialAlertDelivery.deleteMany({
            where: {
              alertId: alert.id
            }
          });
        }

        await tx.socialAlert.update({
          where: {
            id: alert.id
          },
          data: {
            ...alertData,
            ...(sourceChanged
              ? {
                  lastSeenId: null,
                  nextCheckAt: new Date(),
                  consecutiveFailures: 0,
                  lastError: null,
                  lastErrorAt: null
                }
              : {})
          }
        });
      } else {
        await tx.socialAlert.create({
          data: {
            guildId: params.guildId,
            nextCheckAt: new Date(),
            ...alertData
          }
        });
      }
    }
  });

  await prisma.auditLog.create({
    data: {
      guildId: params.guildId,
      actorUserId: access.session.user.discordId,
      action: "DASHBOARD_SOCIAL_ALERTS_UPDATE",
      targetType: "SocialAlert",
      metadata: {
        alerts: input.alerts.map((alert) => `${alert.type}:${alert.sourceId}`)
      }
    }
  });

  return NextResponse.json({ alerts: input.alerts });
}
