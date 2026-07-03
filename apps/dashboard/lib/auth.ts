import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

import { prisma } from "@/lib/prisma";
import { env } from "./env";

type DiscordProfile = {
  id: string;
  username: string;
  avatar?: string | null;
};

type DiscordTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

async function refreshDiscordAccessToken(refreshToken: string) {
  const response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");
    throw new Error(
      `Discord token refresh failed with status ${response.status}${
        responseBody ? `: ${responseBody.slice(0, 300)}` : ""
      }`
    );
  }

  return (await response.json()) as DiscordTokenResponse;
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt"
  },
  providers: [
    DiscordProvider({
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "identify guilds"
        }
      }
    })
  ],
  callbacks: {
    async signIn({ profile }) {
      const discordProfile = profile as DiscordProfile | undefined;

      if (!discordProfile?.id) {
        return false;
      }

      await prisma.user.upsert({
        where: {
          id: discordProfile.id
        },
        create: {
          id: discordProfile.id,
          username: discordProfile.username,
          avatar: discordProfile.avatar ?? null
        },
        update: {
          username: discordProfile.username,
          avatar: discordProfile.avatar ?? null
        }
      });

      return true;
    },
    async jwt({ token, account, profile }) {
      const discordProfile = profile as DiscordProfile | undefined;

      if (account?.access_token) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpiresAt =
          typeof account.expires_at === "number"
            ? account.expires_at
            : Math.floor(Date.now() / 1_000) + Number(account.expires_in ?? 0);
        delete token.authError;
      }

      if (discordProfile?.id) {
        token.discordId = discordProfile.id;
      }

      if (
        token.accessToken &&
        token.accessTokenExpiresAt &&
        Date.now() < token.accessTokenExpiresAt * 1_000 - 60_000
      ) {
        return token;
      }

      if (!token.refreshToken) {
        delete token.accessToken;
        delete token.accessTokenExpiresAt;
        token.authError = "RefreshAccessTokenError";
        return token;
      }

      try {
        const refreshedToken = await refreshDiscordAccessToken(token.refreshToken);

        token.accessToken = refreshedToken.access_token;
        token.refreshToken = refreshedToken.refresh_token ?? token.refreshToken;
        token.accessTokenExpiresAt =
          Math.floor(Date.now() / 1_000) + refreshedToken.expires_in;
        delete token.authError;
      } catch (error) {
        console.error("Unable to refresh Discord access token", error);
        delete token.accessToken;
        delete token.accessTokenExpiresAt;
        delete token.refreshToken;
        token.authError = "RefreshAccessTokenError";
      }

      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.authError = token.authError;

      if (session.user) {
        session.user.id = token.discordId;
        session.user.discordId = token.discordId;
      }

      return session;
    }
  },
  pages: {
    signIn: "/",
    error: "/"
  },
  secret: env.NEXTAUTH_SECRET,
  logger: {
    error(code, metadata) {
      console.error(`[next-auth][${code}]`, metadata);
    },
    warn(code) {
      console.warn(`[next-auth][${code}]`);
    },
    debug(code, metadata) {
      if (process.env.NODE_ENV !== "production") {
        console.debug(`[next-auth][${code}]`, metadata);
      }
    }
  }
};
