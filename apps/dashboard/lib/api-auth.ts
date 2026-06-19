import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getManageableGuilds } from "@/lib/discord";

export async function requireGuildApiAccess(guildId: string) {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "尚未登入" }, { status: 401 })
    };
  }

  const guilds = await getManageableGuilds(session.accessToken);
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
