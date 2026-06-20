import assert from "node:assert/strict";
import test from "node:test";

import { economySettingsSchema } from "@guildforge/shared";

import { calculateDailyReward, calculateTransferFee, getLocalDateKey } from "./calculations";

const settings = economySettingsSchema.parse({});

test("uses the guild timezone at the UTC midnight boundary", () => {
  assert.equal(getLocalDateKey(new Date("2026-06-19T15:59:59.999Z"), "Asia/Taipei"), "2026-06-19");
  assert.equal(getLocalDateKey(new Date("2026-06-19T16:00:00.000Z"), "Asia/Taipei"), "2026-06-20");
});

test("increments a consecutive daily claim and caps the rewarded streak", () => {
  const result = calculateDailyReward(
    {
      lastDailyClaimDate: "2026-06-19",
      dailyStreak: 7
    },
    settings,
    new Date("2026-06-20T04:00:00.000Z")
  );

  assert.equal(result.alreadyClaimed, false);
  assert.equal(result.streak, 8);
  assert.equal(result.amount, 160);
});

test("resets the streak after a missed calendar day", () => {
  const result = calculateDailyReward(
    {
      lastDailyClaimDate: "2026-06-18",
      dailyStreak: 5
    },
    settings,
    new Date("2026-06-20T04:00:00.000Z")
  );

  assert.equal(result.streak, 1);
  assert.equal(result.amount, 100);
});

test("detects a repeated daily claim", () => {
  const result = calculateDailyReward(
    {
      lastDailyClaimDate: "2026-06-20",
      dailyStreak: 3
    },
    settings,
    new Date("2026-06-20T04:00:00.000Z")
  );

  assert.equal(result.alreadyClaimed, true);
});

test("rounds transfer fees upward", () => {
  assert.equal(calculateTransferFee(101, 2.5), 3);
  assert.equal(calculateTransferFee(100, 0), 0);
});
