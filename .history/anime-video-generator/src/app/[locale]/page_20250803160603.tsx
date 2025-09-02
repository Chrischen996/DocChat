import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations('header');

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          {t('title')}
        </h1>
        <p className="text-lg text-gray-600">
          Welcome to the Anime Video Generator!
        </p>
      </div>
    </div>
  );
}
