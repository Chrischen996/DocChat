// import createMiddleware from 'next-intl/middleware';

// export default createMiddleware({
//   // A list of all locales that are supported
//   locales: ['en', 'zh'],

//   // Used when no locale matches
//   defaultLocale: 'en'
// });

// export const config = {
//   // Skip all paths that should not be internationalized
//   matcher: ['/((?!api|_next|.*\\..*).*)']
// };

// Temporary middleware to debug
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  console.log('Middleware called for:', request.nextUrl.pathname);
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)']
};
