import type { Metadata } from "next";
import { IBM_Plex_Sans, Noto_Sans_SC } from "next/font/google";
import "./globals.css";

const bodyFont = Noto_Sans_SC({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const labelFont = IBM_Plex_Sans({
  variable: "--font-label",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "R&D運営診断プラットフォーム / 5C巡検プラットフォーム",
  description: "Lark Base を基盤とした 5C 評価と是正クローズドループの Web アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${bodyFont.variable} ${labelFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
