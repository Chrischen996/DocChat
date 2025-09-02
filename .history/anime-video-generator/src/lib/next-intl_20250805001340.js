'use client';

// Re-export our custom useTranslations hook to override next-intl's hook
export { useTranslations } from '@/components/MainApp';

// Provide mock implementations of other next-intl exports
export const useLocale = () => 'zh';
export const useNow = () => new Date();
export const useTimeZone = () => 'Asia/Shanghai';
export const useFormatter = () => ({
  number: (num) => num.toString(),
  dateTime: (date) => date.toString(),
  relativeTime: (date) => 'recently',
}); 