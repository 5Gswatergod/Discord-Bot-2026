import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { getManageableGuilds } from "@/lib/discord";

export async function requireManageableGuild(guildId: string) {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken || session.authError) {
    redirect("/");
  }

  const guilds = await getManageableGuilds(session.accessToken);
  const guild = guilds.find((item) => item.id === guildId);

  if (!guild) {
    notFound();
  }

  return {
    session,
    guild
  };
}
