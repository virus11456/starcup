import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./arena.css";
import "./portal.css";
import "./pwa.css";
export const metadata: Metadata = {
  title: "星杯傳說",
  description:
    "星杯傳說非官方核心規則測試版。建立房間，邀請好友，展開紅藍陣營對戰。",
  applicationName: "星杯傳說",
  appleWebApp: { capable: true, title: "星杯傳說", statusBarStyle: "black-translucent" },
  icons: {
    icon: "/favicon.svg",
    apple: { url: "/app-icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0e121a",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
