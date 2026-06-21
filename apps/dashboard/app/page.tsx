import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { SignInButton } from "@/components/auth-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";

type HomePageProps = {
  searchParams?: {
    error?: string | string[];
  };
};

const authErrorMessages: Record<string, string> = {
  OAuthSignin: "無法開始 Discord 登入，請檢查 OAuth 應用程式設定。",
  OAuthCallback: "Discord 拒絕或無法完成 OAuth 回呼，請檢查用戶端密鑰與完整的重新導向網址。",
  OAuthCreateAccount: "無法儲存 Discord 帳號。",
  Callback: "驗證回呼失敗。",
  OAuthAccountNotLinked: "此 Discord 帳號已連結至其他登入方式。",
  SessionRequired: "登入工作階段已過期，請重新登入。"
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await getServerSession(authOptions);

  if (session?.accessToken) {
    redirect("/guilds");
  }

  const errorValue = searchParams?.error;
  const errorCode = Array.isArray(errorValue) ? errorValue[0] : errorValue;
  const errorMessage = errorCode
    ? (authErrorMessages[errorCode] ?? "Discord 驗證失敗，請檢查伺服器紀錄。")
    : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-16 items-center justify-between border-b border-border px-4 sm:px-6">
        <p className="text-sm font-bold">Hydrava</p>
        <ThemeToggle />
      </header>
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <h1 className="text-xl font-semibold leading-7">Hydrava</h1>
            <CardDescription>集中管理你擁有權限的 Discord 伺服器。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {errorMessage ? (
              <div
                role="alert"
                className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200"
              >
                <p className="font-medium">Discord 登入失敗</p>
                <p className="mt-1">{errorMessage}</p>
                <p className="mt-2 font-mono text-xs">{errorCode}</p>
              </div>
            ) : null}
            <SignInButton />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
