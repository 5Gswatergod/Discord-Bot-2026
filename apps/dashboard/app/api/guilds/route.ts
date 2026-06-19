import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getManageableGuilds } from "@/lib/discord";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return NextResponse.json(
      {
        error: "尚未登入"
      },
      {
        status: 401
      }
    );
  }

  const guilds = await getManageableGuilds(session.accessToken);

  return NextResponse.json({
    guilds
  });
}
