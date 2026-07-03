import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { DiscordGuildFetchError, getManageableGuilds } from "@/lib/discord";

export async function requireGuildApiAccess(guildId: string) {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken || session.authError) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Discord 登入已過期，請重新登入後再試。" },
        { status: 401 }
      )
    };
  }

  let guilds;

  try {
    guilds = await getManageableGuilds(session.accessToken);
  } catch (error) {
    console.error("Unable to verify Discord guild access", {
      guildId,
      error
    });

    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            error instanceof DiscordGuildFetchError && error.status === 401
              ? "Discord 登入已過期，請重新登入後再試。"
              : "暫時無法確認 Discord 伺服器管理權限，請稍後再試。"
        },
        { status: error instanceof DiscordGuildFetchError && error.status === 401 ? 401 : 502 }
      )
    };
  }

  const guild = guilds.find((item) => item.id === guildId);

  if (!guild) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "沒有管理此伺服器的權限" }, { status: 403 })
    };
  }

  return {
    ok: true as const,
    session,
    guild
  };
}
