'use client';

// Re-export our custom useTranslations hook to override next-intl's hook
export { useTranslations } from '@/components/MainApp';

// Provide mock implementations of other next-intl exports
export const useLocale = () => 'zh';
export const useNow = () => new Date();
export const useTimeZone = () => 'Asia/Shanghai';
export const useFormatter = () => ({
  number: (num: number) => num.toString(),
  dateTime: (date: Date) => date.toString(),
  relativeTime: (date: Date) => 'recently',
});

// Mock the server-side functions
export const getMessages = async () => ({});
export const createTranslator = () => (key: string) => key;

// Mock the plugin
export default function createNextIntlPlugin() {
  return function withNextIntl(config: any) {
    return config;
  };
} 