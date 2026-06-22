"use client";

import { LogIn, LogOut } from "lucide-react";
import { signIn, signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function SignInButton() {
  return (
    <Button onClick={() => signIn("discord", { callbackUrl: "/guilds" })}>
      <LogIn size={16} aria-hidden="true" />
      使用 Discord 登入
    </Button>
  );
}

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  return (
    <Button
      variant="outline"
      size={compact ? "icon" : "default"}
      className={compact ? "lg:hidden" : undefined}
      onClick={() => signOut({ callbackUrl: "/" })}
      aria-label={compact ? "登出" : undefined}
      title={compact ? "登出" : undefined}
    >
      <LogOut size={16} aria-hidden="true" />
      {compact ? null : "登出"}
    </Button>
  );
}
