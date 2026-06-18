import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth-button";
import { GuildCard } from "@/components/guilds/guild-card";
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
            <p className="text-sm font-medium text-primary">GuildForge</p>
            <h1 className="mt-1 text-2xl font-semibold">Servers</h1>
          </div>
          <SignOutButton />
        </header>

        {guilds.length > 0 ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {guilds.map((guild) => (
              <GuildCard key={guild.id} guild={guild} />
            ))}
          </section>
        ) : (
          <section className="rounded-lg border border-border bg-white p-8 text-sm text-muted-foreground shadow-panel">
            No manageable Discord servers were returned by Discord.
          </section>
        )}
      </div>
    </main>
  );
}
