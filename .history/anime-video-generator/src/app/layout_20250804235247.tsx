import type { Metadata } from "next";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import "./globals.css";

type Props = {
  children: React.ReactNode;
  params: { locale?: string };
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
  const locale = params.locale || 'zh';
  let messages;
  try {
    messages = await getMessages({ locale });
  } catch (error) {
    notFound();
  }

  return (
    <html lang={locale}>
      <body className="antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
