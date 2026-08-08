import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 3600;

/**
 * Web app manifest.
 *
 * Served from a route rather than a static file so `start_url` follows the
 * deployment origin, and so the shortcuts stay in step with real routes.
 */
export function GET() {
  const manifest = {
    id: '/',
    name: 'Sadaqa+ — Ensemble, multiplions le bien',
    short_name: 'Sadaqa+',
    description:
      'Sadaqa+ met en relation les personnes qui ont besoin d’aide avec celles et ceux qui sont prêts à aider, partout en Algérie.',
    // The locale segment is added by the proxy, so `/` lands the user in the
    // language they last used rather than forcing French.
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait-primary',
    background_color: '#FBF8F2',
    theme_color: '#00795A',
    dir: 'auto',
    lang: 'fr',
    categories: ['social', 'lifestyle', 'utilities'],
    icons: [
      { src: '/icons/icon-96.png', sizes: '96x96', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Demander de l’aide',
        short_name: 'Demander',
        url: '/fr/requests/new',
        icons: [{ src: '/icons/icon-96.png', sizes: '96x96' }],
      },
      {
        name: 'Besoins urgents',
        short_name: 'Besoins',
        url: '/fr/requests?sort=urgency',
        icons: [{ src: '/icons/icon-96.png', sizes: '96x96' }],
      },
      {
        name: 'Carte',
        short_name: 'Carte',
        url: '/fr/map',
        icons: [{ src: '/icons/icon-96.png', sizes: '96x96' }],
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
