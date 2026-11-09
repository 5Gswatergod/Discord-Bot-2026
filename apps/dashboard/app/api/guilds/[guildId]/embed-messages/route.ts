import { NextResponse } from "next/server";

import { ModuleKey } from "@guildforge/database";
import { embedMessagesUpdateSchema } from "@guildforge/shared";

import { requireGuildApiAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    guildId: string;
  }>;
};

export async function PATCH(request: Request, { params: paramsPromise }: RouteContext) {
  const params = await paramsPromise;
  const access = await requireGuildApiAccess(params.guildId);

  if (!access.ok) {
    return access.response;
  }

  const parsed = embedMessagesUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "嵌入訊息格式不正確" }, { status: 400 });
  }

  const ids = [
    ...new Set(parsed.data.messages.map((message) => message.id).filter(Boolean))
  ] as string[];

  if (ids.length > 0) {
    const ownedCount = await prisma.embedMessage.count({
      where: {
        guildId: params.guildId,
        id: { in: ids }
      }
    });

    if (ownedCount !== ids.length) {
      return NextResponse.json({ error: "找不到嵌入訊息" }, { status: 404 });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.moduleConfig.upsert({
      where: {
        guildId_module: {
          guildId: params.guildId,
          module: ModuleKey.EMBED_MESSAGES
        }
      },
      create: {
        guildId: params.guildId,
        module: ModuleKey.EMBED_MESSAGES,
        enabled: true
      },
      update: {}
    });

    for (const message of parsed.data.messages) {
      const data = {
        channelId: message.channelId,
        content: message.content || null,
        title: message.title || null,
        description: message.description || null,
        color: message.color,
        url: message.url,
        imageUrl: message.imageUrl,
        thumbnailUrl: message.thumbnailUrl,
        footerText: message.footerText || null,
        authorName: message.authorName || null,
        enabled: message.enabled
      };

      if (message.id) {
        await tx.embedMessage.update({
          where: { id: message.id },
          data
        });
      } else {
        await tx.embedMessage.create({
          data: {
            guildId: params.guildId,
            ...data
          }
        });
      }
    }

    await tx.auditLog.create({
      data: {
        guildId: params.guildId,
        actorUserId: access.session.user.discordId,
        action: "DASHBOARD_EMBED_MESSAGES_UPDATE",
        targetType: "EmbedMessage"
      }
    });
  });

  return NextResponse.json({ messages: parsed.data.messages });
}
