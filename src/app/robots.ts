import type { MetadataRoute } from 'next';

/**
 * Robots policy.
 *
 * Everything under an authenticated or moderation surface is disallowed. This
 * is defence in depth for privacy, not access control — those routes already
 * refuse anonymous requests server-side.
 */
export default function robots(): MetadataRoute.Robots {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/*/admin',
          '/*/admin/',
          '/*/dashboard',
          '/*/dashboard/',
          '/*/messages',
          '/*/messages/',
          '/*/notifications',
          '/*/profile',
          '/*/profile/',
          '/*/auth/',
          '/*/search',
          '/*/offline',
        ],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
    host: appUrl,
  };
}
