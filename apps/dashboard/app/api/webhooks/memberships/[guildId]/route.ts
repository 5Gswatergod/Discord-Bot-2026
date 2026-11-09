import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import {
  MembershipEntitlementStatus,
  Prisma
} from "@guildforge/database";
import {
  membershipSettingsSchema,
  membershipWebhookPayloadSchema
} from "@guildforge/shared";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ guildId: string }>;
};

function isValidSignature(body: string, signature: string | null) {
  if (!env.MEMBERSHIP_WEBHOOK_SECRET || !signature) {
    return false;
  }

  const expected = createHmac("sha256", env.MEMBERSHIP_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");
  const supplied = signature.replace(/^sha256=/, "");

  if (!/^[a-fA-F0-9]{64}$/.test(supplied)) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(supplied, "hex"));
}

export async function POST(request: Request, { params: paramsPromise }: RouteContext) {
  const params = await paramsPromise;
  const body = await request.text();

  if (!isValidSignature(body, request.headers.get("x-hydrava-signature"))) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  const parsedJson = (() => {
    try {
      return JSON.parse(body) as unknown;
    } catch {
      return null;
    }
  })();
  const parsed = membershipWebhookPayloadSchema.safeParse(parsedJson);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  const moduleConfig = await prisma.moduleConfig.findUnique({
    where: {
      guildId_module: {
        guildId: params.guildId,
        module: "MEMBERSHIPS"
      }
    },
    select: {
      enabled: true,
      settings: true
    }
  });

  if (!moduleConfig?.enabled) {
    return NextResponse.json({ error: "Membership module is disabled" }, { status: 409 });
  }

  const settings = membershipSettingsSchema.parse(moduleConfig.settings ?? {});

  if (!settings.plans.some((plan) => plan.key === parsed.data.planKey && plan.enabled)) {
    return NextResponse.json({ error: "Unknown membership plan" }, { status: 404 });
  }

  const occurredAt = new Date(parsed.data.occurredAt);

  try {
    await prisma.$transaction(async (tx) => {
      const existingEvent = await tx.membershipWebhookEvent.findUnique({
        where: {
          guildId_eventId: {
            guildId: params.guildId,
            eventId: parsed.data.eventId
          }
        },
        select: { id: true }
      });

      if (existingEvent) {
        return;
      }

      await tx.membershipWebhookEvent.create({
        data: {
          guildId: params.guildId,
          eventId: parsed.data.eventId
        }
      });

      const key = {
        guildId: params.guildId,
        userId: parsed.data.userId,
        planKey: parsed.data.planKey
      };
      const existingEntitlement = await tx.membershipEntitlement.findUnique({
        where: {
          guildId_userId_planKey: key
        },
        select: {
          lastEventAt: true
        }
      });

      if (existingEntitlement && existingEntitlement.lastEventAt > occurredAt) {
        return;
      }

      await tx.membershipEntitlement.upsert({
        where: {
          guildId_userId_planKey: key
        },
        create: {
          ...key,
          status: parsed.data.status as MembershipEntitlementStatus,
          source: "WEBHOOK",
          externalId: parsed.data.externalId,
          expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
          lastEventAt: occurredAt
        },
        update: {
          status: parsed.data.status as MembershipEntitlementStatus,
          source: "WEBHOOK",
          externalId: parsed.data.externalId,
          expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
          lastEventAt: occurredAt,
          lastSyncedAt: new Date(),
          lastError: null
        }
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      JSON.stringify(error.meta ?? {}).includes("eventId")
    ) {
      return NextResponse.json({ accepted: true, duplicate: true }, { status: 202 });
    }

    throw error;
  }

  return NextResponse.json({ accepted: true, eventId: parsed.data.eventId }, { status: 202 });
}
