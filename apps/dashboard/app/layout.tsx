import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "GuildForge Dashboard",
  description: "Self-hosted Discord community operations dashboard"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
