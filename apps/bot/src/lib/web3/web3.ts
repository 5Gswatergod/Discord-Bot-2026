import {
  Contract,
  JsonRpcProvider,
  getAddress
} from "ethers";
import type { Guild } from "discord.js";

import {
  formatTemplate,
  parseWeb3RpcUrls,
  web3SettingsSchema,
  type Web3CollectionInput,
  type Web3Settings
} from "@guildforge/shared";

import type { CommandContext } from "../../commands/types";
import { env } from "../../env";
import { isSendableGuildTextChannel } from "../channels";
import { getGuildModuleSettings } from "../modules";

const erc721Abi = ["function balanceOf(address owner) view returns (uint256)"];
const erc1155Abi = ["function balanceOf(address account, uint256 id) view returns (uint256)"];

async function getCollectionBalance(
  collection: Web3CollectionInput,
  walletAddress: string,
  rpcUrls: Map<number, string>
) {
  const rpcUrl = rpcUrls.get(collection.chainId);

  if (!rpcUrl) {
    throw new Error(`Missing RPC URL for chain ${collection.chainId}`);
  }

  const provider = new JsonRpcProvider(rpcUrl, collection.chainId, {
    staticNetwork: true
  });
  const contract = new Contract(
    getAddress(collection.contractAddress),
    collection.standard === "ERC721" ? erc721Abi : erc1155Abi,
    provider
  );
  const balanceRequest =
    collection.standard === "ERC721"
      ? (contract.balanceOf(walletAddress) as Promise<bigint>)
      : (contract.balanceOf(
          walletAddress,
          BigInt(collection.tokenId ?? "0")
        ) as Promise<bigint>);

  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      balanceRequest,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Web3 RPC request timed out")), 15_000);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
    provider.destroy();
  }
}

async function ensureCollectionChannelAccess(
  guild: Guild,
  collection: Web3CollectionInput,
  context: CommandContext
) {
  for (const channelId of collection.privateChannelIds) {
    const channel = await guild.channels.fetch(channelId).catch(() => null);

    if (!channel || !("permissionOverwrites" in channel)) {
      continue;
    }

    await channel.permissionOverwrites
      .edit(
        guild.roles.everyone.id,
        { ViewChannel: false },
        { reason: `Hydrava Web3 private channel for ${collection.name}` }
      )
      .catch((error) => {
        context.logger.warn("Failed to make Web3 channel private", {
          guildId: guild.id,
          collectionKey: collection.key,
          channelId,
          error
        });
      });
    await channel.permissionOverwrites
      .edit(
        collection.roleId,
        { ViewChannel: true },
        { reason: `Hydrava Web3 collection ${collection.name}` }
      )
      .catch((error) => {
        context.logger.warn("Failed to grant Web3 role private channel access", {
          guildId: guild.id,
          collectionKey: collection.key,
          channelId,
          error
        });
      });
  }
}

async function announceVerification(
  guild: Guild,
  settings: Web3Settings,
  userId: string,
  collection: Web3CollectionInput
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
      content: formatTemplate(settings.verificationMessage, {
        user: `<@${userId}>`,
        username: userId,
        collection: collection.name
      }),
      allowedMentions: {
        users: [userId]
      }
    })
    .catch(() => null);
}

export async function verifyWalletHoldings(
  guildId: string,
  userId: string,
  context: CommandContext
) {
  const moduleConfig = await getGuildModuleSettings(context.prisma, guildId, "WEB3");

  if (!moduleConfig.enabled) {
    return [];
  }

  const settings = web3SettingsSchema.parse(moduleConfig.settings ?? {});
  const wallet = await context.prisma.web3Wallet.findUnique({
    where: {
      guildId_userId: {
        guildId,
        userId
      }
    },
    include: {
      verifications: true
    }
  });

  if (!wallet?.verifiedAt) {
    return [];
  }

  const guild = context.client.guilds.cache.get(guildId);
  const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;

  if (!guild || !member) {
    return [];
  }

  const rpcUrls = parseWeb3RpcUrls(env.WEB3_RPC_URLS_JSON);
  const enabledCollections = settings.collections.filter((collection) => collection.enabled);
  const desiredRoleIds = new Set<string>();
  const newlyEligible: Web3CollectionInput[] = [];

  for (const collection of enabledCollections) {
    await ensureCollectionChannelAccess(guild, collection, context);
    const previous = wallet.verifications.find(
      (verification) => verification.collectionKey === collection.key
    );

    try {
      const balance = await getCollectionBalance(collection, wallet.address, rpcUrls);
      const eligible = balance >= BigInt(collection.minimumBalance);

      if (eligible) {
        desiredRoleIds.add(collection.roleId);

        if (!previous?.eligible) {
          newlyEligible.push(collection);
        }
      }

      await context.prisma.web3Verification.upsert({
        where: {
          walletId_collectionKey: {
            walletId: wallet.id,
            collectionKey: collection.key
          }
        },
        create: {
          guildId,
          walletId: wallet.id,
          collectionKey: collection.key,
          balance: balance.toString(),
          eligible,
          roleAppliedAt: eligible ? new Date() : null
        },
        update: {
          balance: balance.toString(),
          eligible,
          lastCheckedAt: new Date(),
          roleAppliedAt: eligible ? new Date() : null,
          error: null
        }
      });
    } catch (error) {
      await context.prisma.web3Verification.upsert({
        where: {
          walletId_collectionKey: {
            walletId: wallet.id,
            collectionKey: collection.key
          }
        },
        create: {
          guildId,
          walletId: wallet.id,
          collectionKey: collection.key,
          error: error instanceof Error ? error.message.slice(0, 1_000) : "Unknown RPC error"
        },
        update: {
          lastCheckedAt: new Date(),
          error: error instanceof Error ? error.message.slice(0, 1_000) : "Unknown RPC error"
        }
      });
    }
  }

  const configuredRoleIds = new Set(enabledCollections.map((collection) => collection.roleId));

  for (const roleId of configuredRoleIds) {
    const shouldHaveRole = desiredRoleIds.has(roleId);
    const hasRole = member.roles.cache.has(roleId);

    if (shouldHaveRole && !hasRole) {
      await member.roles.add(roleId, "Hydrava Web3 verification").catch((error) => {
        context.logger.warn("Failed to add Web3 verification role", {
          guildId,
          userId,
          roleId,
          error
        });
      });
    } else if (!shouldHaveRole && hasRole) {
      await member.roles.remove(roleId, "Hydrava Web3 eligibility changed").catch((error) => {
        context.logger.warn("Failed to remove Web3 verification role", {
          guildId,
          userId,
          roleId,
          error
        });
      });
    }
  }

  for (const collection of newlyEligible) {
    await announceVerification(guild, settings, userId, collection);
  }

  return enabledCollections.map((collection) => ({
    collection,
    desired: desiredRoleIds.has(collection.roleId)
  }));
}

export async function verifyDueWeb3Wallets(context: CommandContext) {
  const configs = await context.prisma.moduleConfig.findMany({
    where: {
      module: "WEB3",
      enabled: true
    },
    select: {
      guildId: true,
      settings: true
    }
  });

  for (const config of configs) {
    const settings = web3SettingsSchema.parse(config.settings ?? {});
    const dueBefore = new Date(Date.now() - settings.recheckHours * 60 * 60 * 1_000);
    const wallets = await context.prisma.web3Wallet.findMany({
      where: {
        guildId: config.guildId,
        verifiedAt: { not: null },
        OR: [
          { verifications: { none: {} } },
          { verifications: { some: { lastCheckedAt: { lte: dueBefore } } } }
        ]
      },
      select: {
        userId: true
      }
    });

    for (const wallet of wallets) {
      await verifyWalletHoldings(config.guildId, wallet.userId, context);
    }
  }
}
