import { NextResponse } from "next/server";

import { ModuleKey, PollVisibility } from "@guildforge/database";
import { pollsUpdateSchema } from "@guildforge/shared";

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

  const parsed = pollsUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid polls" }, { status: 400 });
  }

  const input = parsed.data;
  const pollIds = [...new Set(input.polls.map((poll) => poll.id).filter(Boolean))] as string[];

  if (pollIds.length > 0) {
    const ownedPollCount = await prisma.poll.count({
      where: {
        guildId: params.guildId,
        id: {
          in: pollIds
        }
      }
    });

    if (ownedPollCount !== pollIds.length) {
      return NextResponse.json({ error: "Poll not found" }, { status: 404 });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.moduleConfig.upsert({
      where: {
        guildId_module: {
          guildId: params.guildId,
          module: ModuleKey.POLLS
        }
      },
      create: {
        guildId: params.guildId,
        module: ModuleKey.POLLS,
        enabled: true
      },
      update: {}
    });

    for (const poll of input.polls) {
      const pollData = {
        channelId: poll.channelId,
        question: poll.question,
        visibility: poll.visibility as PollVisibility,
        endsAt: poll.endsAt
      };
      const saved = poll.id
        ? await tx.poll.update({
            where: {
              id: poll.id
            },
            data: pollData
          })
        : await tx.poll.create({
            data: {
              guildId: params.guildId,
              createdByUserId: access.session.user.discordId ?? "dashboard",
              ...pollData
            }
          });

      await tx.pollOption.deleteMany({
        where: {
          pollId: saved.id
        }
      });

      await tx.pollOption.createMany({
        data: poll.options.map((label, index) => ({
          guildId: params.guildId,
          pollId: saved.id,
          label,
          sortOrder: index
        }))
      });
    }
  });

  await prisma.auditLog.create({
    data: {
      guildId: params.guildId,
      actorUserId: access.session.user.discordId,
      action: "DASHBOARD_POLLS_UPDATE",
      targetType: "Poll"
    }
  });

  return NextResponse.json({ polls: input.polls });
}
