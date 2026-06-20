import { NextResponse } from "next/server";

import { EconomyShopItemStatus, EconomyShopItemType, ModuleKey } from "@guildforge/database";
import { economyShopUpdateSchema } from "@guildforge/shared";

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

  const parsed = economyShopUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "商店商品格式不正確" }, { status: 400 });
  }

  const itemIds = [
    ...new Set(parsed.data.items.map((item) => item.id).filter(Boolean))
  ] as string[];
  const existingItems =
    itemIds.length > 0
      ? await prisma.economyShopItem.findMany({
          where: {
            guildId: params.guildId,
            id: {
              in: itemIds
            }
          }
        })
      : [];

  if (existingItems.length !== itemIds.length) {
    return NextResponse.json({ error: "找不到部分商店商品" }, { status: 404 });
  }

  const existingMap = new Map(existingItems.map((item) => [item.id, item]));

  for (const item of parsed.data.items) {
    const existing = item.id ? existingMap.get(item.id) : null;

    if (existing?.soldCount && existing.type !== item.type) {
      return NextResponse.json(
        { error: `已售出的商品「${existing.name}」不可變更商品類型` },
        { status: 400 }
      );
    }

    if (
      item.stock !== null &&
      item.stock !== undefined &&
      item.stock < (existing?.soldCount ?? 0)
    ) {
      return NextResponse.json(
        { error: `商品「${item.name}」的庫存不可低於已售數量` },
        { status: 400 }
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.moduleConfig.upsert({
      where: {
        guildId_module: {
          guildId: params.guildId,
          module: ModuleKey.ECONOMY
        }
      },
      create: {
        guildId: params.guildId,
        module: ModuleKey.ECONOMY,
        enabled: true
      },
      update: {}
    });

    for (const item of parsed.data.items) {
      const data = {
        name: item.name,
        description: item.description || null,
        type: item.type as EconomyShopItemType,
        price: item.price,
        roleId: item.type === "ROLE" ? item.roleId : null,
        stock: item.stock,
        perUserLimit: item.type === "ROLE" ? 1 : item.perUserLimit,
        status: item.status as EconomyShopItemStatus
      };

      if (item.id) {
        await tx.economyShopItem.update({
          where: {
            id: item.id
          },
          data
        });
      } else {
        await tx.economyShopItem.create({
          data: {
            guildId: params.guildId,
            ...data
          }
        });
      }
    }
  });

  await prisma.auditLog.create({
    data: {
      guildId: params.guildId,
      actorUserId: access.session.user.discordId,
      action: "DASHBOARD_ECONOMY_SHOP_UPDATE",
      targetType: "EconomyShopItem",
      metadata: {
        itemCount: parsed.data.items.length
      }
    }
  });

  return NextResponse.json({ items: parsed.data.items });
}
