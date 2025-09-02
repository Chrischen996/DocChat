import type { Metadata } from "next";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import "../globals.css";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return {
    title: locale === 'zh' ? "动漫视频生成器" : "Anime Video Generator",
    description: locale === 'zh'
      ? "使用字节跳动豆包 Seedance 模型生成动漫风格视频的AI工具"
      : "Generate anime-style videos using AI with ByteDance's Doubao Seedance model",
  };
}

export function generateStaticParams() {
  return ['en', 'zh'].map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params
}: Props) {
  const { locale } = await params;
  // Validate that the incoming `locale` parameter is valid
  if (!['en', 'zh'].includes(locale)) {
    notFound();
  }

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = locale === 'zh'
    ? (await import('../../../messages/zh.json')).default
    : (await import('../../../messages/en.json')).default;

  return (
    <html lang={locale}>
      <body className="antialiased">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
