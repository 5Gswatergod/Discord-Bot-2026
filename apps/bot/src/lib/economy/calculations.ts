import type { EconomySettings } from "@guildforge/shared";

export function getLocalDateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function getPreviousDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function calculateDailyReward(
  account: {
    lastDailyClaimDate: string | null;
    dailyStreak: number;
  },
  settings: EconomySettings,
  now: Date
) {
  const today = getLocalDateKey(now, settings.timeZone);
  const alreadyClaimed = account.lastDailyClaimDate === today;
  const streak =
    account.lastDailyClaimDate === getPreviousDateKey(today) ? account.dailyStreak + 1 : 1;
  const rewardedStreak = Math.min(streak, settings.dailyStreakCap);
  const amount =
    settings.dailyBaseReward + Math.max(0, rewardedStreak - 1) * settings.dailyStreakBonus;

  return {
    today,
    alreadyClaimed,
    streak,
    amount
  };
}

export function calculateTransferFee(amount: number, feePercent: number) {
  return Math.ceil((amount * feePercent) / 100);
}
