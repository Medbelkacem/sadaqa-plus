import { expect, test } from '@playwright/test';

/**
 * Public surface: locale routing, honest empty states, real zero statistics,
 * security headers and the PWA manifest.
 */

test.describe('locale routing', () => {
  test('redirects the bare root to a locale', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.url()).toMatch(/\/(fr|ar|en)$/);
  });

  test('serves French with dir=ltr', async ({ page }) => {
    await page.goto('/fr');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr-DZ');
  });

  test('serves Arabic with dir=rtl', async ({ page }) => {
    await page.goto('/ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar-DZ');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('معًا');
  });

  test('serves English', async ({ page }) => {
    await page.goto('/en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Together');
  });

  test('404s an unknown locale rather than silently falling back', async ({ page }) => {
    const response = await page.goto('/zz/requests');
    expect(response?.status()).toBe(404);
  });
});

test.describe('honest empty states', () => {
  test('homepage shows empty states, not placeholder cards', async ({ page }) => {
    await page.goto('/fr');

    // Each section must say plainly that there is nothing yet.
    await expect(page.getByText('Aucune campagne pour le moment')).toBeVisible();
    await expect(page.getByText('Aucun événement à venir')).toBeVisible();
  });

  test('request list shows either results or an empty state, never a stuck skeleton', async ({
    page,
  }) => {
    await page.goto('/fr/requests');
    const body = await page.textContent('body');
    expect(body).toMatch(/Aucune demande vérifiée|résultats/);
  });

  test('map page renders', async ({ page }) => {
    await page.goto('/fr/map');
    await expect(page.getByRole('heading', { name: /Carte/i })).toBeVisible();
  });
});

test.describe('security headers', () => {
  test('sets CSP, frame and content-type protections', async ({ page }) => {
    const response = await page.goto('/fr');
    const headers = response?.headers() ?? {};

    expect(headers['content-security-policy']).toBeTruthy();
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['content-security-policy']).toContain("object-src 'none'");
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['permissions-policy']).toContain('microphone=()');
  });

  test('uses a per-request CSP nonce', async ({ page }) => {
    const first = await page.goto('/fr');
    const second = await page.goto('/en');

    const csp1 = first?.headers()['content-security-policy'] ?? '';
    const csp2 = second?.headers()['content-security-policy'] ?? '';

    const nonce = /'nonce-([^']+)'/;
    expect(csp1).toMatch(nonce);
    expect(csp1.match(nonce)?.[1]).not.toBe(csp2.match(nonce)?.[1]);
  });
});

test.describe('PWA', () => {
  test('serves a valid manifest', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest');
    expect(response.status()).toBe(200);

    const manifest = await response.json();
    expect(manifest.name).toContain('Sadaqa+');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
    expect(manifest.icons.some((icon: { purpose: string }) => icon.purpose === 'maskable')).toBe(
      true,
    );
  });

  test('serves a service worker that refuses to cache private surfaces', async ({ request }) => {
    const response = await request.get('/sw.js');
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain('PRIVATE_PREFIXES');
    expect(body).toContain('/api/');
  });

  test('robots.txt disallows private areas', async ({ request }) => {
    const response = await request.get('/robots.txt');
    const body = await response.text();

    expect(body).toContain('Disallow: /api/');
    expect(body).toContain('/*/admin');
    expect(body).toContain('/*/dashboard');
  });
});

test.describe('accessibility basics', () => {
  test('has a skip link and exactly one h1', async ({ page }) => {
    await page.goto('/fr');

    await expect(page.getByRole('link', { name: /Aller au contenu principal/i })).toBeAttached();
    await expect(page.locator('h1')).toHaveCount(1);
  });

  test('shows bottom navigation on mobile only', async ({ page, isMobile }) => {
    await page.goto('/fr');
    const bottomNav = page.locator('nav.fixed.bottom-0');

    if (isMobile) {
      await expect(bottomNav).toBeVisible();
    } else {
      await expect(bottomNav).toBeHidden();
    }
  });
});
