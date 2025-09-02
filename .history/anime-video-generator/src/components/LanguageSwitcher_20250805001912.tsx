'use client';

import React from 'react';
import { useTranslations } from '@/components/MainApp';
import { useRouter, usePathname } from 'next/navigation';

const LanguageSwitcher: React.FC = () => {
  const t = useTranslations('languageSwitcher');
  const locale = 'zh'; // Hardcoded since we only support Chinese
  const router = useRouter();
  const pathname = usePathname();

  // Since we only support one language, this component can be simplified
  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-600">{t('label')}</span>
      <span className="text-sm font-medium text-gray-900">中文</span>
    </div>
  );
};

export default LanguageSwitcher;
