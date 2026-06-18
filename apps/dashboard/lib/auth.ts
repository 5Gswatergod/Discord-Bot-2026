import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

import { prisma } from "@/lib/prisma";
import { env } from "./env";

type DiscordProfile = {
  id: string;
  username: string;
  avatar?: string | null;
};

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
      }

      if (discordProfile?.id) {
        token.discordId = discordProfile.id;
      }

      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;

      if (session.user) {
        session.user.id = token.discordId;
        session.user.discordId = token.discordId;
      }

      return session;
    }
  },
  pages: {
    signIn: "/"
  },
  secret: env.NEXTAUTH_SECRET
};
