import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

const rootEnvPath = fileURLToPath(new URL("../../../.env", import.meta.url));

if (existsSync(rootEnvPath)) {
  config({
    path: rootEnvPath
  });
}

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is missing. Create the repository root .env file from .env.example and set DATABASE_URL."
  );
  process.exit(1);
}

const prismaCliPath = fileURLToPath(
  new URL("../node_modules/prisma/build/index.js", import.meta.url)
);
const child = spawn(process.execPath, [prismaCliPath, ...process.argv.slice(2)], {
  env: process.env,
  stdio: "inherit"
});

child.on("error", (error) => {
  console.error("Failed to start Prisma CLI.", error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
