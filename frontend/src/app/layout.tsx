import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocChat Agent",
  description: "Agentic RAG workspace with traces, citations, and feedback.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className="h-full antialiased">
      <body
        className="flex min-h-dvh flex-col overflow-x-hidden"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
