"use client";

import { LogIn, LogOut } from "lucide-react";
import { signIn, signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function SignInButton() {
  return (
    <Button onClick={() => signIn("discord", { callbackUrl: "/guilds" })}>
      <LogIn size={16} aria-hidden="true" />
      Sign in with Discord
    </Button>
  );
}

export function SignOutButton() {
  return (
    <Button variant="outline" onClick={() => signOut({ callbackUrl: "/" })}>
      <LogOut size={16} aria-hidden="true" />
      Sign out
    </Button>
  );
}
