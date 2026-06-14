import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocChat AI",
  description: "A focused chat workspace for documents, research, and writing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body
        className="min-h-dvh overflow-x-hidden flex flex-col"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
