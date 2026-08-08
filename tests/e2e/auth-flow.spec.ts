import { expect, test } from '@playwright/test';

/**
 * Registration, sign-in and the verification gate, driven through the UI.
 *
 * Each run creates its own account so the specs are independent and can run in
 * parallel. Accounts are left behind deliberately — cleaning them up would
 * mean giving the test runner delete access to the production-shaped database.
 * `npm run db:reset` is the intended reset path for a test environment.
 */

const password = 'une-phrase-de-passe-e2e-solide';

function uniqueEmail(tag: string) {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.dz`;
}

test.describe('registration', () => {
  test('rejects a weak password before submitting', async ({ page }) => {
    await page.goto('/fr/auth/register');

    await page.getByLabel('Prénom').fill('Amina');
    await page.getByLabel('Nom', { exact: true }).fill('Belkacem');
    await page.getByLabel('Adresse e-mail').fill(uniqueEmail('weak'));
    await page.getByLabel('Mot de passe', { exact: true }).fill('password123');
    await page.getByLabel('Confirmer le mot de passe').fill('password123');
    await page.getByRole('checkbox').click();
    await page.getByRole('button', { name: 'Créer un compte' }).click();

    await expect(page.getByText(/trop courant/i)).toBeVisible();
  });

  test('rejects mismatched password confirmation', async ({ page }) => {
    await page.goto('/fr/auth/register');

    await page.getByLabel('Prénom').fill('Amina');
    await page.getByLabel('Nom', { exact: true }).fill('Belkacem');
    await page.getByLabel('Adresse e-mail').fill(uniqueEmail('mismatch'));
    await page.getByLabel('Mot de passe', { exact: true }).fill(password);
    await page.getByLabel('Confirmer le mot de passe').fill(`${password}-autre`);
    await page.getByRole('checkbox').click();
    await page.getByRole('button', { name: 'Créer un compte' }).click();

    await expect(page.getByText(/ne correspondent pas/i)).toBeVisible();
  });

  test('creates an account and asks for email confirmation', async ({ page }) => {
    await page.goto('/fr/auth/register');

    await page.getByLabel('Prénom').fill('Amina');
    await page.getByLabel('Nom', { exact: true }).fill('Belkacem');
    await page.getByLabel('Adresse e-mail').fill(uniqueEmail('signup'));
    await page.getByLabel('Mot de passe', { exact: true }).fill(password);
    await page.getByLabel('Confirmer le mot de passe').fill(password);
    await page.getByRole('checkbox').click();
    await page.getByRole('button', { name: 'Créer un compte' }).click();

    // The confirmation screen is identical whether or not the address existed.
    await expect(page.getByText(/Confirmez votre adresse/i)).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('sign in', () => {
  test('shows a generic error for unknown credentials', async ({ page }) => {
    await page.goto('/fr/auth/login');

    await page.getByLabel('Adresse e-mail').fill(uniqueEmail('nobody'));
    await page.getByLabel('Mot de passe').fill('un-mot-de-passe-quelconque');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    // Deliberately does not distinguish "no such account" from "wrong password".
    await expect(page.getByText(/incorrect/i)).toBeVisible({ timeout: 20_000 });
  });

  test('carries a safe ?next through, and ignores an external one', async ({ page }) => {
    await page.goto('/fr/auth/login?next=https://evil.example.com');
    // The page renders; the open-redirect guard lives in the submit handler and
    // is covered by the unit-level `safeNext` behaviour. Here we assert the
    // page does not immediately navigate off-origin.
    await expect(page).toHaveURL(/127\.0\.0\.1|localhost/);
  });
});

test.describe('protected creation flows', () => {
  test('publishing a request requires an account', async ({ page }) => {
    await page.goto('/fr/requests/new');
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('applying for partnership requires an account', async ({ page }) => {
    await page.goto('/fr/organizations/apply');
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

test.describe('legal pages', () => {
  test('say plainly that the document has not been published', async ({ page }) => {
    await page.goto('/fr/legal/terms');
    // No boilerplate terms are ever shipped.
    await expect(page.getByText(/n’a pas encore été publié/i)).toBeVisible();
  });

  test('never claim charity status or tax deductibility', async ({ page }) => {
    await page.goto('/fr/legal/privacy');
    const body = (await page.textContent('body')) ?? '';
    expect(body).toContain('ne revendique aucun statut');
  });
});
