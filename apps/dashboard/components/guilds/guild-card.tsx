import { Bot, ExternalLink, Settings } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { ManageableGuild } from "@/lib/discord";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type GuildCardProps = {
  guild: ManageableGuild;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function GuildCard({ guild }: GuildCardProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {guild.iconUrl ? (
            <Image
              src={guild.iconUrl}
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 rounded-md bg-muted object-cover"
              unoptimized={guild.iconUrl.includes(".gif")}
              loading="lazy"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted text-sm font-semibold text-muted-foreground">
              {initials(guild.name)}
            </div>
          )}
          <div className="min-w-0">
            <CardTitle className="truncate">{guild.name}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {guild.memberCount?.toLocaleString("zh-TW") ?? "未知"} 位成員
            </p>
          </div>
        </div>
        <Badge variant={guild.botJoined ? "default" : "warning"}>
          <Bot size={12} aria-hidden="true" />
          {guild.botJoined ? "機器人已就緒" : "尚未邀請"}
        </Badge>
      </CardHeader>
      <CardContent className="flex gap-2">
        {guild.botJoined ? (
          <Button asChild className="w-full">
            <Link href={`/guilds/${guild.id}`}>
              <Settings size={16} aria-hidden="true" />
              管理
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline" className="w-full">
            <a href={guild.inviteUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={16} aria-hidden="true" />
              邀請機器人
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
