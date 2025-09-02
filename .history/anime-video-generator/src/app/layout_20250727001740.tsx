import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anime Video Generator",
  description: "Generate anime-style videos using AI with ByteDance's Doubao Seedance model",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
