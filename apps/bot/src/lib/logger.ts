export type Logger = typeof logger;

function write(level: "info" | "warn" | "error", message: string, metadata?: unknown) {
  const payload = {
    level,
    message,
    metadata,
    timestamp: new Date().toISOString()
  };

  const line = JSON.stringify(payload, (_key, value) =>
    value instanceof Error
      ? {
          name: value.name,
          message: value.message,
          stack: value.stack,
          ...("code" in value && (typeof value.code === "string" || typeof value.code === "number")
            ? { code: value.code }
            : {}),
          ...("status" in value && typeof value.status === "number" ? { status: value.status } : {})
        }
      : value
  );

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export const logger = {
  info(message: string, metadata?: unknown) {
    write("info", message, metadata);
  },
  warn(message: string, metadata?: unknown) {
    write("warn", message, metadata);
  },
  error(message: string, metadata?: unknown) {
    write("error", message, metadata);
  }
};
