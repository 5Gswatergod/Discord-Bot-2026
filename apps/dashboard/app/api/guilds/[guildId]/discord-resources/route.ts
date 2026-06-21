import { NextResponse } from "next/server";

import { requireGuildApiAccess } from "@/lib/api-auth";
import { getDiscordGuildResources } from "@/lib/discord-resources";

type RouteContext = {
  params: {
    guildId: string;
  };
};

export async function GET(_request: Request, { params }: RouteContext) {
  const access = await requireGuildApiAccess(params.guildId);

  if (!access.ok) {
    return access.response;
  }

  if (!access.guild.botJoined) {
    return NextResponse.json(
      { error: "請先將 Hydrava 機器人加入此伺服器，才能載入頻道與身分組。" },
      { status: 409 }
    );
  }

  try {
    return NextResponse.json(await getDiscordGuildResources(params.guildId));
  } catch (error) {
    console.error("Unable to load Discord guild resources", {
      guildId: params.guildId,
      error
    });

    return NextResponse.json(
      { error: "無法從 Discord 載入頻道與身分組，請確認機器人仍在伺服器內且權限正常。" },
      { status: 502 }
    );
  }
}
