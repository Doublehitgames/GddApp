import { test, expect } from '@playwright/test';

test.describe('@critical GDD Manager - Sync crítico', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.addCookies([
      {
        name: 'e2e-bypass-auth',
        value: '1',
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ]);

    await page.route('**/api/projects/sync', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('deve enviar sync sem refresh após criar projeto e seções', async ({ page }) => {
    const syncPayloads: any[] = [];

    await page.unroute('**/api/projects/sync');
    await page.route('**/api/projects/sync', async (route) => {
      if (route.request().method() === 'POST') {
        const data = route.request().postDataJSON();
        syncPayloads.push(data);
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto('/projects');

    await page.getByPlaceholder('Nome do projeto').fill('Projeto Sync E2E');
    await page.getByPlaceholder('Descrição').fill('Teste de sincronização sem refresh');
    await page.getByRole('button', { name: 'Salvar Projeto' }).click();

    await expect(page).toHaveURL(/\/projects\/.+/);

    const projectIdFromUrl = page.url().split('/projects/')[1];

    await page.getByPlaceholder('Nova seção').fill('Seção E2E');
    await page.getByRole('button', { name: 'Adicionar' }).first().click();

    await page.getByRole('link', { name: 'Seção E2E' }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectIdFromUrl}/sections/.+`));

    await page.getByPlaceholder('Adicionar subseção').fill('Sub E2E');
    await page.getByRole('button', { name: 'Adicionar' }).first().click();

    await expect.poll(() => syncPayloads.length, { timeout: 10000 }).toBeGreaterThan(1);

    const hasProjectPayload = syncPayloads.some((payload) => payload?.project?.id === projectIdFromUrl);
    expect(hasProjectPayload).toBeTruthy();

    const hasSectionAndSubsection = syncPayloads.some((payload) => {
      const sections = payload?.project?.sections || [];
      const titles = sections.map((s: any) => s.title);
      return titles.includes('Seção E2E') && titles.includes('Sub E2E');
    });
    expect(hasSectionAndSubsection).toBeTruthy();
  });

  test('deve manter dados locais após reload', async ({ page }) => {
    await page.goto('/projects');

    await page.getByPlaceholder('Nome do projeto').fill('Projeto Reload E2E');
    await page.getByPlaceholder('Descrição').fill('Persistência após reload');
    await page.getByRole('button', { name: 'Salvar Projeto' }).click();

    await expect(page).toHaveURL(/\/projects\/.+/);
    await page.reload();

    await expect(page.getByText('Projeto Reload E2E')).toBeVisible();
  });
});
