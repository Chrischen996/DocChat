import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "动漫视频生成器",
  description: "使用字节跳动豆包 Seedance 模型生成动漫风格视频的AI工具",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body className="antialiased">{children}</body>
    </html>
  );
}
