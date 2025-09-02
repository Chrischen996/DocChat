import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  // Only support Chinese locale
  locales: ['zh'],

  // Use Chinese as default
  defaultLocale: 'zh'
});

export const config = {
  // Skip all paths that should not be internationalized
  matcher: ['/((?!api|_next|.*\\..*).*)']
};
