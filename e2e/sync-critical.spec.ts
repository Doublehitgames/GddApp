import { test, expect, type Page } from '@playwright/test';

/** Cria um projeto pelo diálogo da home (só o nome) e espera a home do projeto abrir. */
async function createProject(page: Page, name: string) {
  await page.goto('/');
  await page.getByRole('button', { name: /Novo projeto/i }).first().click();
  await page.getByRole('button', { name: /Novo projeto em branco/i }).click();
  await page.getByPlaceholder('Nome do jogo').fill(name);
  await page.getByRole('button', { name: 'Criar projeto', exact: true }).click();
  await page.waitForURL(/\/projects\/[^/?]+/, { timeout: 15000 });
}

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
      { name: 'gdd_locale', value: 'pt-BR', domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
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

    await createProject(page, 'Projeto Sync E2E');

    // Documento novo pela área de Documentação
    await page.goto(page.url().replace(/\?.*$/, '') + '/documentacao');
    await page.getByRole('button', { name: /Novo documento/i }).click();
    await page.getByPlaceholder('Nome do documento').fill('Seção E2E');
    await page.getByRole('button', { name: 'Criar', exact: true }).click();
    await page.waitForURL(/\/sections\//, { timeout: 15000 });

    await expect.poll(() => syncPayloads.length, { timeout: 10000 }).toBeGreaterThan(0);

    // A URL usa slug, então validamos o payload pelo título do projeto
    const hasProjectPayload = syncPayloads.some((payload) => payload?.project?.title === 'Projeto Sync E2E');
    expect(hasProjectPayload).toBeTruthy();

  });

  test('deve manter dados locais após reload', async ({ page }) => {
    await createProject(page, 'Projeto Reload E2E');
    await page.reload();

    await expect(page.getByText('Projeto Reload E2E').first()).toBeVisible();
  });
});
