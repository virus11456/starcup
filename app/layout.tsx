import type { Metadata } from "next";
import "./globals.css";
import "./arena.css";
import "./portal.css";
export const metadata: Metadata = {
  title: "星杯傳說 Online · 星辰之間，與你並肩",
  description:
    "星杯傳說非官方核心規則測試版。建立房間，邀請好友，展開紅藍陣營對戰。",
  icons: { icon: "/favicon.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
