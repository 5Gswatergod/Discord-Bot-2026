import "dotenv/config";

import { botEnvSchema } from "@guildforge/config";

export const env = botEnvSchema.parse(process.env);
