const durationPattern = /^(\d+)(s|m|h|d)$/i;

export function parseDurationToSeconds(value: string) {
  const match = durationPattern.exec(value.trim());

  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return null;
  }

  const multiplier = unit === "s" ? 1 : unit === "m" ? 60 : unit === "h" ? 3_600 : 86_400;

  return amount * multiplier;
}

export function formatDuration(seconds: number) {
  if (seconds % 86_400 === 0) {
    return `${seconds / 86_400}d`;
  }

  if (seconds % 3_600 === 0) {
    return `${seconds / 3_600}h`;
  }

  if (seconds % 60 === 0) {
    return `${seconds / 60}m`;
  }

  return `${seconds}s`;
}
