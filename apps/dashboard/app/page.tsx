import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { SignInButton } from "@/components/auth-button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";

type HomePageProps = {
  searchParams?: {
    error?: string | string[];
  };
};

const authErrorMessages: Record<string, string> = {
  OAuthSignin: "Discord sign-in could not be started. Check the OAuth application settings.",
  OAuthCallback:
    "Discord rejected or could not complete the OAuth callback. Check the Client Secret and exact redirect URL.",
  OAuthCreateAccount: "The Discord account could not be stored.",
  Callback: "The authentication callback failed.",
  OAuthAccountNotLinked: "This Discord account is already linked to another sign-in method.",
  SessionRequired: "Your session has expired. Sign in again."
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await getServerSession(authOptions);

  if (session?.accessToken) {
    redirect("/guilds");
  }

  const errorValue = searchParams?.error;
  const errorCode = Array.isArray(errorValue) ? errorValue[0] : errorValue;
  const errorMessage = errorCode
    ? (authErrorMessages[errorCode] ?? "Discord authentication failed. Check the server logs.")
    : null;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-xl font-semibold leading-7">GuildForge</h1>
          <CardDescription>Discord operations for servers you manage.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {errorMessage ? (
            <div
              role="alert"
              className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900"
            >
              <p className="font-medium">Discord sign-in failed</p>
              <p className="mt-1">{errorMessage}</p>
              <p className="mt-2 font-mono text-xs">{errorCode}</p>
            </div>
          ) : null}
          <SignInButton />
        </CardContent>
      </Card>
    </main>
  );
}
