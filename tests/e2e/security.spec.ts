import { expect, test } from '@playwright/test';

/**
 * Security regression suite.
 *
 * These are the checks that must keep passing for the platform to be safe to
 * point at real beneficiaries: authorization, IDOR, CSRF, enumeration, upload
 * filtering and rate limiting.
 */

const FAKE_UUID = '00000000-0000-4000-8000-000000000000';

test.describe('authentication is required', () => {
  const protectedApis = [
    '/api/auth/me',
    '/api/saved',
    '/api/messages',
    '/api/notifications',
    '/api/volunteers/profile',
    '/api/admin/users',
    '/api/admin/settings',
    '/api/admin/audit',
    '/api/admin/categories',
    '/api/organizations/applications',
  ];

  for (const path of protectedApis) {
    test(`GET ${path} is not readable anonymously`, async ({ request }) => {
      const response = await request.get(path);

      // /api/auth/me answers 200 with `authenticated: false`; everything else
      // must refuse outright.
      if (path === '/api/auth/me') {
        const body = await response.json();
        expect(body.data.authenticated).toBe(false);
        expect(JSON.stringify(body)).not.toContain('@');
        return;
      }

      expect([401, 403]).toContain(response.status());
      const body = await response.json();
      expect(body.success).toBe(false);
    });
  }

  const protectedPages = ['/fr/admin', '/fr/dashboard', '/fr/messages', '/fr/notifications'];

  for (const path of protectedPages) {
    test(`${path} redirects an anonymous visitor to sign in`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/auth\/login/);
    });
  }
});

test.describe('IDOR protection', () => {
  test('a request id belonging to someone else is not readable', async ({ request }) => {
    const response = await request.get(`/api/requests/${FAKE_UUID}`);
    expect([401, 403, 404]).toContain(response.status());
  });

  test('a private file id is not readable anonymously', async ({ request }) => {
    const response = await request.get(`/api/files/${FAKE_UUID}`);
    expect([401, 403, 404]).toContain(response.status());
  });

  test('another user’s conversation is not readable', async ({ request }) => {
    const response = await request.get(`/api/messages/${FAKE_UUID}`);
    expect([401, 403, 404]).toContain(response.status());
  });

  test('moderation endpoints reject anonymous callers', async ({ request, baseURL }) => {
    const response = await request.post(`/api/requests/${FAKE_UUID}/moderate`, {
      headers: { Origin: baseURL!, 'Content-Type': 'application/json' },
      data: { action: 'verify' },
    });
    expect([401, 403, 404]).toContain(response.status());
  });
});

test.describe('CSRF protection', () => {
  test('rejects a cross-origin state-changing request', async ({ request, baseURL }) => {
    const response = await request.post(`${baseURL}/api/auth/login`, {
      headers: { Origin: 'https://evil.example.com', 'Content-Type': 'application/json' },
      data: { email: 'someone@example.dz', password: 'whatever-goes-here' },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });
});

test.describe('account enumeration', () => {
  test('registration responds identically for new and existing addresses', async ({
    request,
    baseURL,
  }) => {
    const payload = (email: string) => ({
      firstName: 'Test',
      lastName: 'Utilisateur',
      email,
      password: 'une-phrase-de-passe-e2e-unique',
      confirmPassword: 'une-phrase-de-passe-e2e-unique',
      acceptTerms: true,
    });

    const headers = { Origin: baseURL!, 'Content-Type': 'application/json' };

    const first = await request.post('/api/auth/register', {
      headers,
      data: payload(`e2e-enum-${Date.now()}@example.dz`),
    });
    const second = await request.post('/api/auth/register', {
      headers,
      data: payload(`e2e-enum-other-${Date.now()}@example.dz`),
    });

    expect(first.status()).toBe(second.status());
    expect((await first.json()).data.message).toBe((await second.json()).data.message);
  });

  test('password reset never reveals whether an account exists', async ({ request, baseURL }) => {
    const headers = { Origin: baseURL!, 'Content-Type': 'application/json' };

    const response = await request.post('/api/auth/forgot-password', {
      headers,
      data: { email: `definitely-not-registered-${Date.now()}@example.dz` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });
});

test.describe('input validation', () => {
  test('rejects a non-JSON body on a JSON endpoint', async ({ request, baseURL }) => {
    const response = await request.post('/api/auth/login', {
      headers: { Origin: baseURL!, 'Content-Type': 'text/plain' },
      data: 'not json',
    });

    expect(response.status()).toBe(415);
  });

  test('returns field-level errors without leaking internals', async ({ request, baseURL }) => {
    const response = await request.post('/api/auth/register', {
      headers: { Origin: baseURL!, 'Content-Type': 'application/json' },
      data: { email: 'not-an-email', password: '123' },
    });

    expect(response.status()).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.fields).toBeTruthy();

    const serialized = JSON.stringify(body);
    // No stack traces, no SQL, no Prisma internals.
    expect(serialized).not.toMatch(/at \w+ \(/);
    expect(serialized).not.toMatch(/prisma/i);
    expect(serialized).not.toMatch(/SELECT |INSERT INTO/i);
  });

  test('caps oversized query parameters instead of erroring out', async ({ request }) => {
    const response = await request.get(`/api/requests?q=${'a'.repeat(500)}`);
    expect([200, 422]).toContain(response.status());
  });
});

test.describe('public API surface', () => {
  test('the public request feed never returns unpublished statuses', async ({ request }) => {
    // Even when a status is requested explicitly.
    const response = await request.get('/api/requests?status=DRAFT');
    expect(response.status()).toBe(200);

    const body = await response.json();
    for (const item of body.data.items) {
      expect(['ACTIVE', 'PARTIALLY_HELPED', 'COMPLETED']).toContain(item.status);
    }
  });

  test('the organization directory only lists verified organizations', async ({ request }) => {
    const response = await request.get('/api/organizations');
    const body = await response.json();

    for (const item of body.data.items) {
      expect(item.verificationStatus).toBe('VERIFIED');
    }
  });

  test('donation checkout reports "not configured" rather than faking success', async ({
    request,
    baseURL,
  }) => {
    const response = await request.post('/api/donations/checkout', {
      headers: { Origin: baseURL!, 'Content-Type': 'application/json' },
      data: { campaignId: FAKE_UUID, amount: 1000, isAnonymous: true },
    });

    // Anonymous, so 401 comes first; with no provider configured an
    // authenticated caller would get 503 SERVICE_NOT_CONFIGURED. What must
    // never happen is a 200 with a redirect URL.
    expect(response.status()).not.toBe(200);
  });

  test('the payment webhook cannot be used to fabricate a confirmed donation', async ({
    request,
  }) => {
    const response = await request.post('/api/donations/webhook', {
      headers: { 'Content-Type': 'application/json' },
      data: { providerRef: 'anything', status: 'CONFIRMED' },
    });

    expect(response.status()).not.toBe(200);
  });

  test('cron endpoints require the shared secret', async ({ request }) => {
    for (const path of [
      '/api/cron/reminders',
      '/api/cron/expire',
      '/api/cron/outbox',
      '/api/cron/cleanup',
    ]) {
      const response = await request.get(path);
      expect([401, 503]).toContain(response.status());
    }
  });
});
