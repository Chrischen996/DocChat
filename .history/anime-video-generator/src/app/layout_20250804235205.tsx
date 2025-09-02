import type { Metadata } from "next";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import "./globals.css";

type Props = {
  children: React.ReactNode;
  params: { locale: string };
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "动漫视频生成器",
    description: "使用字节跳动豆包 Seedance 模型生成动漫风格视频的AI工具",
  };
}

export default async function RootLayout({
  children,
  params
}: Props) {
  let messages;
  try {
    messages = await getMessages();
  } catch (error) {
    notFound();
  }

  return (
    <html lang={params.locale}>
      <body className="antialiased">
        <NextIntlClientProvider locale={params.locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
