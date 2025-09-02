import MainApp from '@/components/MainApp';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';

type Props = {
  params: { locale?: string };
};

export default async function RootPage({ params }: Props) {
  const locale = params?.locale || 'zh';
  let messages;
  try {
    messages = await getMessages({ locale });
  } catch (error) {
    notFound();
  }

  return <MainApp locale={locale} messages={messages} />;
}
