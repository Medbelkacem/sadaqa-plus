import { NextResponse, type NextRequest } from 'next/server';

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  negotiateLocale,
} from '@/i18n/config';

/**
 * Edge concerns handled here, in this order:
 *   1. Locale resolution and redirect to a `/{locale}/…` URL.
 *   2. A per-request nonce for the Content-Security-Policy.
 *   3. Security headers for every response.
 *
 * Authorization is deliberately NOT done here. Middleware can only see the
 * session cookie, not whether it maps to a live session with the right role —
 * so every protected page and route handler re-checks server-side. Middleware
 * only shortcuts obviously-anonymous traffic away from private areas.
 */

const PUBLIC_FILE = /\.(?:png|jpe?g|gif|svg|webp|ico|txt|xml|json|webmanifest|js|css|woff2?)$/i;

/** Paths that must never be locale-prefixed. */
function isExempt(pathname: string) {
  return (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/_vercel/') ||
    pathname === '/sw.js' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/favicon.ico' ||
    PUBLIC_FILE.test(pathname)
  );
}

function buildCsp(nonce: string, isDev: boolean) {
  // `'strict-dynamic'` lets the nonce-approved Next.js bootstrap load its own
  // chunks without whitelisting every path. Dev needs 'unsafe-eval' for React
  // Refresh; production does not.
  const scriptSrc = [
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    "'self'",
    isDev ? "'unsafe-eval'" : '',
    'https:',
  ]
    .filter(Boolean)
    .join(' ');

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // Tailwind and Radix inject inline style attributes; a nonce cannot cover
    // those, so styles stay 'unsafe-inline'. Style injection alone is not a
    // script-execution vector.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://*.tile.openstreetmap.org https://tile.openstreetmap.org",
    "font-src 'self' data:",
    "connect-src 'self' https://*.tile.openstreetmap.org" + (isDev ? ' ws: http://localhost:*' : ''),
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}

function applySecurityHeaders(headers: Headers, nonce: string, isDev: boolean) {
  headers.set('Content-Security-Policy', buildCsp(nonce, isDev));
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-DNS-Prefetch-Control', 'off');
  headers.set(
    'Permissions-Policy',
    'camera=(self), microphone=(), geolocation=(self), payment=(), usb=(), interest-cohort=()',
  );
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  if (!isDev) {
    headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isDev = process.env.NODE_ENV === 'development';

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  if (isExempt(pathname)) {
    const response = NextResponse.next();
    applySecurityHeaders(response.headers, nonce, isDev);
    return response;
  }

  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];

  if (!isLocale(firstSegment)) {
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    const locale = isLocale(cookieLocale)
      ? cookieLocale
      : negotiateLocale(request.headers.get('accept-language')) || DEFAULT_LOCALE;

    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
    url.search = search;

    const response = NextResponse.redirect(url);
    applySecurityHeaders(response.headers, nonce, isDev);
    return response;
  }

  // Forward the nonce so the root layout can stamp it onto Next's scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('x-pathname', pathname);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  applySecurityHeaders(response.headers, nonce, isDev);

  // Keep the cookie in step with the URL so the next bare-path visit lands in
  // the same language.
  if (request.cookies.get(LOCALE_COOKIE)?.value !== firstSegment) {
    response.cookies.set(LOCALE_COOKIE, firstSegment, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
