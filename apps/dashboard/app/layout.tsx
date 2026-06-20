import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Hydrava 管理面板",
  description: "自架式 Discord 社群管理面板"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
