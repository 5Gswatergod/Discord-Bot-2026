import { dashboardEnvSchema } from "@guildforge/config";

export const env = dashboardEnvSchema.parse(process.env);
