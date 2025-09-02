import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  // All locales are handled by the root layout now
  locales: [],
});

export const config = {
  // Skip all paths that should not be internationalized
  matcher: ['/((?!api|_next|.*\\..*).*)']
};
