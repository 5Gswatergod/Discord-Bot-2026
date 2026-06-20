import { randomInt, randomUUID } from "node:crypto";
import type { Message } from "discord.js";

import {
  EconomyShopItemStatus,
  EconomyShopItemType,
  EconomyTransactionType,
  Prisma,
  type DatabaseClient
} from "@guildforge/database";
import { economyMaxBalance, economySettingsSchema, type EconomySettings } from "@guildforge/shared";

import type { CommandContext } from "../../commands/types";
import { getGuildModuleSettings } from "../modules";
import { calculateDailyReward, calculateTransferFee } from "./calculations";

type TransactionClient = Prisma.TransactionClient;

export class EconomyError extends Error {
  constructor(
    public readonly code:
      | "DISABLED"
      | "FEATURE_DISABLED"
      | "INVALID_OPERATION"
      | "COOLDOWN"
      | "INSUFFICIENT_BALANCE"
      | "BALANCE_LIMIT"
      | "ITEM_NOT_FOUND"
      | "ITEM_UNAVAILABLE"
      | "OUT_OF_STOCK"
      | "PURCHASE_LIMIT",
    message: string
  ) {
    super(message);
    this.name = "EconomyError";
  }
}

async function runSerializable<T>(
  prisma: DatabaseClient,
  callback: (tx: TransactionClient) => Promise<T>
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 10_000
      });
    } catch (error) {
      if (
        attempt < 2 &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Economy transaction retry limit reached.");
}

async function ensureAccount(tx: TransactionClient, guildId: string, userId: string) {
  return tx.economyAccount.upsert({
    where: {
      guildId_userId: {
        guildId,
        userId
      }
    },
    create: {
      guildId,
      userId
    },
    update: {}
  });
}

export async function getEconomySettings(prisma: DatabaseClient, guildId: string) {
  const config = await getGuildModuleSettings(prisma, guildId, "ECONOMY");

  return {
    enabled: config.enabled,
    settings: economySettingsSchema.parse(config.settings ?? {})
  };
}

export async function getEconomyAccount(prisma: DatabaseClient, guildId: string, userId: string) {
  return prisma.economyAccount.upsert({
    where: {
      guildId_userId: {
        guildId,
        userId
      }
    },
    create: {
      guildId,
      userId
    },
    update: {}
  });
}

async function addTransaction(
  tx: TransactionClient,
  input: {
    guildId: string;
    accountId: string;
    userId: string;
    type: EconomyTransactionType;
    amount: number;
    balanceAfter: number;
    actorUserId?: string | null;
    relatedUserId?: string | null;
    shopItemId?: string | null;
    referenceId?: string | null;
    description?: string | null;
    metadata?: Prisma.InputJsonValue;
  }
) {
  return tx.economyTransaction.create({
    data: input
  });
}

export async function grantMessageReward(
  context: CommandContext,
  input: {
    guildId: string;
    userId: string;
    channelId: string;
    memberRoleIds: string[];
  }
) {
  const { enabled, settings } = await getEconomySettings(context.prisma, input.guildId);

  if (
    !enabled ||
    !settings.messageRewardsEnabled ||
    settings.messageRewardMax <= 0 ||
    settings.messageIgnoredChannelIds.includes(input.channelId) ||
    input.memberRoleIds.some((roleId) => settings.messageIgnoredRoleIds.includes(roleId))
  ) {
    return null;
  }

  const redisKey = `economy:message:${input.guildId}:${input.userId}`;

  if (context.redis) {
    try {
      const acquired = await context.redis.set(
        redisKey,
        String(Date.now()),
        "EX",
        settings.messageRewardCooldownSeconds,
        "NX"
      );

      if (acquired !== "OK") {
        return null;
      }
    } catch (error) {
      context.logger.warn("Redis economy cooldown unavailable; using database cooldown", {
        guildId: input.guildId,
        userId: input.userId,
        error
      });
    }
  }

  const amount = randomInt(settings.messageRewardMin, settings.messageRewardMax + 1);

  if (amount <= 0) {
    return null;
  }

  const cutoff = new Date(Date.now() - settings.messageRewardCooldownSeconds * 1000);

  return context.prisma.$transaction(async (tx) => {
    await ensureAccount(tx, input.guildId, input.userId);
    const updated = await tx.economyAccount.updateMany({
      where: {
        guildId: input.guildId,
        userId: input.userId,
        balance: {
          lte: economyMaxBalance - amount
        },
        OR: [
          {
            lastMessageRewardAt: null
          },
          {
            lastMessageRewardAt: {
              lte: cutoff
            }
          }
        ]
      },
      data: {
        balance: {
          increment: amount
        },
        lastMessageRewardAt: new Date()
      }
    });

    if (updated.count === 0) {
      return null;
    }

    const account = await tx.economyAccount.findUniqueOrThrow({
      where: {
        guildId_userId: {
          guildId: input.guildId,
          userId: input.userId
        }
      }
    });
    await addTransaction(tx, {
      guildId: input.guildId,
      accountId: account.id,
      userId: input.userId,
      type: EconomyTransactionType.MESSAGE_REWARD,
      amount,
      balanceAfter: account.balance,
      metadata: {
        channelId: input.channelId
      }
    });

    return {
      amount,
      balance: account.balance
    };
  });
}

export async function handleEconomyMessage(message: Message<true>, context: CommandContext) {
  if (message.author.bot) {
    return;
  }

  await grantMessageReward(context, {
    guildId: message.guild.id,
    userId: message.author.id,
    channelId: message.channelId,
    memberRoleIds: message.member?.roles.cache.map((role) => role.id) ?? []
  }).catch((error) => {
    context.logger.warn("Failed to grant economy message reward", {
      guildId: message.guild.id,
      userId: message.author.id,
      error
    });
  });
}

export async function claimDailyReward(
  prisma: DatabaseClient,
  guildId: string,
  userId: string,
  settings: EconomySettings,
  now = new Date()
) {
  if (!settings.dailyRewardsEnabled) {
    throw new EconomyError("FEATURE_DISABLED", "此伺服器已停用每日獎勵。");
  }

  return runSerializable(prisma, async (tx) => {
    const account = await ensureAccount(tx, guildId, userId);
    const daily = calculateDailyReward(account, settings, now);

    if (daily.alreadyClaimed) {
      throw new EconomyError("COOLDOWN", "你今天已經領取過每日獎勵。");
    }

    if (account.balance > economyMaxBalance - daily.amount) {
      throw new EconomyError("BALANCE_LIMIT", "領取後會超過帳戶餘額上限。");
    }

    const updated = await tx.economyAccount.update({
      where: {
        id: account.id
      },
      data: {
        balance: {
          increment: daily.amount
        },
        lastDailyClaimDate: daily.today,
        dailyStreak: daily.streak
      }
    });
    await addTransaction(tx, {
      guildId,
      accountId: updated.id,
      userId,
      type: EconomyTransactionType.DAILY_REWARD,
      amount: daily.amount,
      balanceAfter: updated.balance,
      metadata: {
        localDate: daily.today,
        streak: daily.streak
      }
    });

    return {
      amount: daily.amount,
      balance: updated.balance,
      streak: daily.streak
    };
  });
}

export async function transferCurrency(
  prisma: DatabaseClient,
  input: {
    guildId: string;
    senderUserId: string;
    recipientUserId: string;
    amount: number;
    settings: EconomySettings;
  }
) {
  if (!input.settings.transfersEnabled) {
    throw new EconomyError("FEATURE_DISABLED", "此伺服器已停用成員轉帳。");
  }

  if (input.senderUserId === input.recipientUserId) {
    throw new EconomyError("INVALID_OPERATION", "你不能轉帳給自己。");
  }

  if (input.amount < input.settings.minimumTransfer) {
    throw new EconomyError("INVALID_OPERATION", "轉帳金額低於此伺服器設定的最低金額。");
  }

  const fee = calculateTransferFee(input.amount, input.settings.transferFeePercent);
  const total = input.amount + fee;
  const referenceId = randomUUID();

  return runSerializable(prisma, async (tx) => {
    const sender = await ensureAccount(tx, input.guildId, input.senderUserId);
    const recipient = await ensureAccount(tx, input.guildId, input.recipientUserId);

    if (sender.balance < total) {
      throw new EconomyError("INSUFFICIENT_BALANCE", "你的餘額不足以支付轉帳與手續費。");
    }

    if (recipient.balance > economyMaxBalance - input.amount) {
      throw new EconomyError("BALANCE_LIMIT", "收款人的帳戶已接近餘額上限。");
    }

    const debited = await tx.economyAccount.updateMany({
      where: {
        id: sender.id,
        balance: {
          gte: total
        }
      },
      data: {
        balance: {
          decrement: total
        }
      }
    });

    if (debited.count === 0) {
      throw new EconomyError("INSUFFICIENT_BALANCE", "你的餘額不足以完成轉帳。");
    }

    const updatedSender = await tx.economyAccount.findUniqueOrThrow({
      where: {
        id: sender.id
      }
    });
    const updatedRecipient = await tx.economyAccount.update({
      where: {
        id: recipient.id
      },
      data: {
        balance: {
          increment: input.amount
        }
      }
    });

    await addTransaction(tx, {
      guildId: input.guildId,
      accountId: sender.id,
      userId: input.senderUserId,
      type: EconomyTransactionType.TRANSFER_SENT,
      amount: -input.amount,
      balanceAfter: updatedSender.balance + fee,
      relatedUserId: input.recipientUserId,
      referenceId
    });

    if (fee > 0) {
      await addTransaction(tx, {
        guildId: input.guildId,
        accountId: sender.id,
        userId: input.senderUserId,
        type: EconomyTransactionType.TRANSFER_FEE,
        amount: -fee,
        balanceAfter: updatedSender.balance,
        relatedUserId: input.recipientUserId,
        referenceId
      });
    }

    await addTransaction(tx, {
      guildId: input.guildId,
      accountId: recipient.id,
      userId: input.recipientUserId,
      type: EconomyTransactionType.TRANSFER_RECEIVED,
      amount: input.amount,
      balanceAfter: updatedRecipient.balance,
      relatedUserId: input.senderUserId,
      referenceId
    });

    return {
      amount: input.amount,
      fee,
      senderBalance: updatedSender.balance,
      recipientBalance: updatedRecipient.balance,
      referenceId
    };
  });
}

export async function grantLevelReward(
  context: CommandContext,
  input: {
    guildId: string;
    userId: string;
    level: number;
  }
) {
  const { enabled, settings } = await getEconomySettings(context.prisma, input.guildId);

  if (!enabled || !settings.levelRewardsEnabled) {
    return null;
  }

  const amount = settings.levelRewardBase + input.level * settings.levelRewardMultiplier;

  if (amount <= 0 || amount > economyMaxBalance) {
    return null;
  }

  return context.prisma.$transaction(async (tx) => {
    await ensureAccount(tx, input.guildId, input.userId);
    const updated = await tx.economyAccount.updateMany({
      where: {
        guildId: input.guildId,
        userId: input.userId,
        lastLevelRewarded: {
          lt: input.level
        },
        balance: {
          lte: economyMaxBalance - amount
        }
      },
      data: {
        balance: {
          increment: amount
        },
        lastLevelRewarded: input.level
      }
    });

    if (updated.count === 0) {
      return null;
    }

    const account = await tx.economyAccount.findUniqueOrThrow({
      where: {
        guildId_userId: {
          guildId: input.guildId,
          userId: input.userId
        }
      }
    });
    await addTransaction(tx, {
      guildId: input.guildId,
      accountId: account.id,
      userId: input.userId,
      type: EconomyTransactionType.LEVEL_REWARD,
      amount,
      balanceAfter: account.balance,
      metadata: {
        level: input.level
      }
    });

    return {
      amount,
      balance: account.balance,
      currencySymbol: settings.currencySymbol
    };
  });
}

export async function adjustBalance(
  prisma: DatabaseClient,
  input: {
    guildId: string;
    userId: string;
    actorUserId: string;
    mode: "add" | "remove" | "set";
    amount: number;
    reason: string;
  }
) {
  return runSerializable(prisma, async (tx) => {
    const account = await ensureAccount(tx, input.guildId, input.userId);
    const nextBalance =
      input.mode === "add"
        ? account.balance + input.amount
        : input.mode === "remove"
          ? account.balance - input.amount
          : input.amount;

    if (nextBalance < 0) {
      throw new EconomyError("INSUFFICIENT_BALANCE", "調整後的餘額不可小於 0。");
    }

    if (nextBalance > economyMaxBalance) {
      throw new EconomyError("BALANCE_LIMIT", "調整後的餘額超過系統上限。");
    }

    const updated = await tx.economyAccount.update({
      where: {
        id: account.id
      },
      data: {
        balance: nextBalance
      }
    });
    const type =
      input.mode === "add"
        ? EconomyTransactionType.ADMIN_ADD
        : input.mode === "remove"
          ? EconomyTransactionType.ADMIN_REMOVE
          : EconomyTransactionType.ADMIN_SET;

    await addTransaction(tx, {
      guildId: input.guildId,
      accountId: account.id,
      userId: input.userId,
      type,
      amount: nextBalance - account.balance,
      balanceAfter: nextBalance,
      actorUserId: input.actorUserId,
      description: input.reason
    });

    return updated;
  });
}

export async function purchaseShopItem(
  prisma: DatabaseClient,
  input: {
    guildId: string;
    userId: string;
    itemId: string;
  }
) {
  const referenceId = randomUUID();

  return runSerializable(prisma, async (tx) => {
    const item = await tx.economyShopItem.findFirst({
      where: {
        id: input.itemId,
        guildId: input.guildId
      }
    });

    if (!item) {
      throw new EconomyError("ITEM_NOT_FOUND", "找不到此商店商品。");
    }

    if (item.status !== EconomyShopItemStatus.ACTIVE) {
      throw new EconomyError("ITEM_UNAVAILABLE", "此商品目前未上架。");
    }

    if (item.stock !== null && item.soldCount >= item.stock) {
      throw new EconomyError("OUT_OF_STOCK", "此商品已售完。");
    }

    const account = await ensureAccount(tx, input.guildId, input.userId);
    const inventory = await tx.economyInventoryItem.findUnique({
      where: {
        accountId_shopItemId: {
          accountId: account.id,
          shopItemId: item.id
        }
      }
    });
    const currentQuantity = inventory?.quantity ?? 0;
    const limit = item.type === EconomyShopItemType.ROLE ? 1 : item.perUserLimit;

    if (limit !== null && limit !== undefined && currentQuantity >= limit) {
      throw new EconomyError("PURCHASE_LIMIT", "你已達到此商品的購買上限。");
    }

    const debited = await tx.economyAccount.updateMany({
      where: {
        id: account.id,
        balance: {
          gte: item.price
        }
      },
      data: {
        balance: {
          decrement: item.price
        }
      }
    });

    if (debited.count === 0) {
      throw new EconomyError("INSUFFICIENT_BALANCE", "你的餘額不足以購買此商品。");
    }

    const stockUpdated =
      item.stock === null
        ? await tx.economyShopItem.updateMany({
            where: {
              id: item.id,
              status: EconomyShopItemStatus.ACTIVE
            },
            data: {
              soldCount: {
                increment: 1
              }
            }
          })
        : await tx.economyShopItem.updateMany({
            where: {
              id: item.id,
              status: EconomyShopItemStatus.ACTIVE,
              soldCount: {
                lt: item.stock
              }
            },
            data: {
              soldCount: {
                increment: 1
              }
            }
          });

    if (stockUpdated.count === 0) {
      throw new EconomyError("OUT_OF_STOCK", "此商品剛剛已售完。");
    }

    await tx.economyInventoryItem.upsert({
      where: {
        accountId_shopItemId: {
          accountId: account.id,
          shopItemId: item.id
        }
      },
      create: {
        guildId: input.guildId,
        accountId: account.id,
        userId: input.userId,
        shopItemId: item.id,
        quantity: 1
      },
      update: {
        quantity: {
          increment: 1
        }
      }
    });
    const updatedAccount = await tx.economyAccount.findUniqueOrThrow({
      where: {
        id: account.id
      }
    });
    await addTransaction(tx, {
      guildId: input.guildId,
      accountId: account.id,
      userId: input.userId,
      type: EconomyTransactionType.SHOP_PURCHASE,
      amount: -item.price,
      balanceAfter: updatedAccount.balance,
      shopItemId: item.id,
      referenceId,
      description: item.name
    });

    return {
      item,
      balance: updatedAccount.balance,
      referenceId
    };
  });
}

export async function refundRolePurchase(
  prisma: DatabaseClient,
  input: {
    guildId: string;
    userId: string;
    itemId: string;
    referenceId: string;
    reason: string;
  }
) {
  return runSerializable(prisma, async (tx) => {
    const existingRefund = await tx.economyTransaction.findFirst({
      where: {
        guildId: input.guildId,
        userId: input.userId,
        referenceId: input.referenceId,
        type: EconomyTransactionType.REFUND
      }
    });

    if (existingRefund) {
      return false;
    }

    const item = await tx.economyShopItem.findFirstOrThrow({
      where: {
        id: input.itemId,
        guildId: input.guildId
      }
    });
    const account = await ensureAccount(tx, input.guildId, input.userId);
    const inventory = await tx.economyInventoryItem.findUnique({
      where: {
        accountId_shopItemId: {
          accountId: account.id,
          shopItemId: item.id
        }
      }
    });

    if (!inventory || inventory.quantity <= 0) {
      return false;
    }

    if (inventory.quantity === 1) {
      await tx.economyInventoryItem.delete({
        where: {
          id: inventory.id
        }
      });
    } else {
      await tx.economyInventoryItem.update({
        where: {
          id: inventory.id
        },
        data: {
          quantity: {
            decrement: 1
          }
        }
      });
    }

    await tx.economyShopItem.update({
      where: {
        id: item.id
      },
      data: {
        soldCount: {
          decrement: 1
        }
      }
    });
    const refunded = await tx.economyAccount.updateMany({
      where: {
        id: account.id,
        balance: {
          lte: economyMaxBalance - item.price
        }
      },
      data: {
        balance: {
          increment: item.price
        }
      }
    });

    if (refunded.count === 0) {
      throw new EconomyError("BALANCE_LIMIT", "退款後會超過帳戶餘額上限。");
    }

    const updated = await tx.economyAccount.findUniqueOrThrow({
      where: {
        id: account.id
      }
    });
    await addTransaction(tx, {
      guildId: input.guildId,
      accountId: account.id,
      userId: input.userId,
      type: EconomyTransactionType.REFUND,
      amount: item.price,
      balanceAfter: updated.balance,
      shopItemId: item.id,
      referenceId: input.referenceId,
      description: input.reason
    });

    return true;
  });
}
