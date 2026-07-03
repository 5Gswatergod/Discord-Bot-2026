import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    authError?: "RefreshAccessTokenError";
    user: {
      id?: string;
      discordId?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    accessTokenExpiresAt?: number;
    refreshToken?: string;
    authError?: "RefreshAccessTokenError";
    discordId?: string;
  }
}
