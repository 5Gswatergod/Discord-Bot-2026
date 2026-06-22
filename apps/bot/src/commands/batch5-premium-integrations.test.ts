import assert from "node:assert/strict";
import test from "node:test";

import {
  MembershipEntitlementStatus
} from "@guildforge/database";
import {
  aiAssistantSettingsSchema,
  membershipSettingsSchema,
  membershipWebhookPayloadSchema,
  parseWeb3RpcUrls,
  web3SettingsSchema,
  web3WalletAddressSchema,
  web3WalletSignatureSchema
} from "@guildforge/shared";

import { entitlementShouldBeActive } from "../lib/memberships/memberships";

test("provides cost-safe batch five defaults", () => {
  const ai = aiAssistantSettingsSchema.parse({});
  const memberships = membershipSettingsSchema.parse({});
  const web3 = web3SettingsSchema.parse({});

  assert.equal(ai.mentionOnly, true);
  assert.equal(ai.dailyRequestLimit, 100);
  assert.equal(memberships.plans.length, 0);
  assert.equal(web3.collections.length, 0);
  assert.equal(web3.recheckHours, 24);
});

test("rejects duplicate plans and incomplete ERC-1155 collections", () => {
  assert.equal(
    membershipSettingsSchema.safeParse({
      plans: [
        { key: "gold", name: "Gold", roleId: "12345" },
        { key: "gold", name: "Gold 2", roleId: "67890" }
      ]
    }).success,
    false
  );
  assert.equal(
    web3SettingsSchema.safeParse({
      collections: [
        {
          key: "vip-nft",
          name: "VIP NFT",
          chainId: 1,
          contractAddress: "0x1111111111111111111111111111111111111111",
          standard: "ERC1155",
          roleId: "12345"
        }
      ]
    }).success,
    false
  );
});

test("validates membership webhooks and wallet inputs", () => {
  assert.equal(
    membershipWebhookPayloadSchema.safeParse({
      eventId: "evt_1",
      userId: "12345",
      planKey: "gold",
      status: "ACTIVE",
      occurredAt: "2026-06-22T00:00:00.000Z"
    }).success,
    true
  );
  assert.equal(
    web3WalletAddressSchema.safeParse("0x1111111111111111111111111111111111111111").success,
    true
  );
  assert.equal(web3WalletSignatureSchema.safeParse(`0x${"ab".repeat(65)}`).success, true);
});

test("applies membership grace periods deterministically", () => {
  const now = new Date("2026-06-22T00:00:00.000Z");

  assert.equal(
    entitlementShouldBeActive(
      {
        status: MembershipEntitlementStatus.ACTIVE,
        expiresAt: new Date("2026-06-23T00:00:00.000Z")
      },
      0,
      now
    ),
    true
  );
  assert.equal(
    entitlementShouldBeActive(
      {
        status: MembershipEntitlementStatus.PAST_DUE,
        expiresAt: new Date("2026-06-21T00:00:00.000Z")
      },
      3,
      now
    ),
    true
  );
  assert.equal(
    entitlementShouldBeActive(
      {
        status: MembershipEntitlementStatus.CANCELED,
        expiresAt: null
      },
      3,
      now
    ),
    false
  );
});

test("parses configured EVM RPC URLs", () => {
  const rpcUrls = parseWeb3RpcUrls(
    JSON.stringify({
      1: "https://ethereum.example",
      137: "https://polygon.example",
      invalid: "ftp://invalid.example"
    })
  );

  assert.equal(rpcUrls.get(1), "https://ethereum.example");
  assert.equal(rpcUrls.get(137), "https://polygon.example");
});
