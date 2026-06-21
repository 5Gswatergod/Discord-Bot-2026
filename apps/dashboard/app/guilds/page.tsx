import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth-button";
import { GuildCard } from "@/components/guilds/guild-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { authOptions } from "@/lib/auth";
import { getManageableGuilds } from "@/lib/discord";

export default async function GuildSelectorPage() {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    redirect("/");
  }

  const guilds = await getManageableGuilds(session.accessToken);

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Hydrava</p>
            <h1 className="mt-1 text-2xl font-semibold">伺服器</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </header>

        {guilds.length > 0 ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {guilds.map((guild) => (
              <GuildCard key={guild.id} guild={guild} />
            ))}
          </section>
        ) : (
          <section className="rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground shadow-panel">
            Discord 沒有回傳你可管理的伺服器。
          </section>
        )}
      </div>
    </main>
  );
}
