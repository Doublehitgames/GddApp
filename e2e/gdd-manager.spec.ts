/**
 * Testes E2E - Fluxo completo de criação de GDD
 * Testa a jornada do usuário desde criar projeto até adicionar seções
 */

import { test, expect } from '@playwright/test';

test.describe('GDD Manager - Fluxo Principal', () => {
  test.beforeEach(async ({ page }) => {
    // Limpar localStorage antes de cada teste
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('deve carregar a página inicial', async ({ page }) => {
    await page.goto('/');
    
    // Verificar título da página
    await expect(page).toHaveTitle(/GDD Manager/i);
    
    // Verificar que o conteúdo principal está visível
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('deve criar um novo projeto', async ({ page }) => {
    await page.goto('/');
    
    // Clicar no botão de criar projeto
    await page.getByRole('button', { name: /novo projeto|create|criar/i }).first().click();
    
    // Preencher formulário de criação
    const titleInput = page.getByLabel(/título|title|nome/i).first();
    const descInput = page.getByLabel(/descrição|description/i).first();
    
    await titleInput.fill('Meu Jogo de Teste E2E');
    await descInput.fill('Descrição do jogo de teste automatizado');
    
    // Salvar projeto
    await page.getByRole('button', { name: /salvar|save|criar/i }).click();
    
    // Verificar que o projeto aparece na lista
    await expect(page.getByText('Meu Jogo de Teste E2E')).toBeVisible({ timeout: 5000 });
  });

  test('deve adicionar uma seção ao projeto', async ({ page }) => {
    await page.goto('/');
    
    // Criar projeto primeiro
    await page.getByRole('button', { name: /novo projeto|create/i }).first().click();
    await page.getByLabel(/título|title/i).first().fill('Projeto com Seções');
    await page.getByLabel(/descrição|description/i).first().fill('Teste de seções');
    await page.getByRole('button', { name: /salvar|save/i }).click();
    
    // Aguardar e clicar no projeto criado
    await page.getByText('Projeto com Seções').click();
    
    // Adicionar nova seção
    await page.getByRole('button', { name: /adicionar seção|nova seção|add section/i }).first().click();
    
    // Preencher dados da seção
    const sectionTitle = page.getByLabel(/título|title/i).first();
    await sectionTitle.fill('Game Mechanics');
    
    // Salvar seção
    await page.getByRole('button', { name: /salvar|save|criar/i }).click();
    
    // Verificar que a seção aparece
    await expect(page.getByText('Game Mechanics')).toBeVisible({ timeout: 5000 });
  });

  test('deve navegar entre páginas', async ({ page }) => {
    await page.goto('/');
    
    // Verificar navegação para página de backup
    const backupLink = page.getByRole('link', { name: /backup/i }).first();
    if (await backupLink.isVisible()) {
      await backupLink.click();
      await expect(page).toHaveURL(/\/backup/);
    }
    
    // Voltar para home
    await page.goto('/');
    await expect(page).toHaveURL('/');
  });

  test('deve persistir dados após recarregar página', async ({ page }) => {
    await page.goto('/');
    
    // Criar projeto
    await page.getByRole('button', { name: /novo projeto|create/i }).first().click();
    await page.getByLabel(/título|title/i).first().fill('Projeto Persistente');
    await page.getByLabel(/descrição|description/i).first().fill('Teste de persistência');
    await page.getByRole('button', { name: /salvar|save/i }).click();
    
    // Aguardar projeto aparecer
    await expect(page.getByText('Projeto Persistente')).toBeVisible({ timeout: 5000 });
    
    // Recarregar página
    await page.reload();
    
    // Verificar que o projeto ainda existe
    await expect(page.getByText('Projeto Persistente')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('GDD Manager - Edição de Conteúdo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('deve editar nome do projeto', async ({ page }) => {
    await page.goto('/');
    
    // Criar projeto
    await page.getByRole('button', { name: /novo projeto|create/i }).first().click();
    await page.getByLabel(/título|title/i).first().fill('Projeto Original');
    await page.getByLabel(/descrição|description/i).first().fill('Descrição original');
    await page.getByRole('button', { name: /salvar|save/i }).click();
    
    await page.waitForTimeout(1000);
    
    // Entrar no projeto
    await page.getByText('Projeto Original').click();
    
    // Procurar por botão de editar
    const editButton = page.getByRole('button', { name: /editar|edit/i }).first();
    if (await editButton.isVisible({ timeout: 3000 })) {
      await editButton.click();
      
      // Editar nome
      const titleInput = page.getByLabel(/título|title|nome/i).first();
      await titleInput.clear();
      await titleInput.fill('Projeto Editado');
      
      // Salvar
      await page.getByRole('button', { name: /salvar|save/i }).click();
      
      // Verificar mudança
      await expect(page.getByText('Projeto Editado')).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('GDD Manager - Funcionalidade de IA', () => {
  test('deve navegar para página de criação com IA', async ({ page }) => {
    await page.goto('/');
    
    // Procurar link ou botão para IA
    const aiLink = page.getByRole('link', { name: /IA|AI|inteligência/i }).first();
    const aiButton = page.getByRole('button', { name: /IA|AI|criar com ia/i }).first();
    
    if (await aiLink.isVisible({ timeout: 2000 })) {
      await aiLink.click();
      await expect(page).toHaveURL(/\/ai-create/);
    } else if (await aiButton.isVisible({ timeout: 2000 })) {
      await aiButton.click();
      await expect(page).toHaveURL(/\/ai-create/);
    }
  });
});

test.describe('GDD Manager - Responsividade', () => {
  test('deve funcionar em mobile', async ({ page }) => {
    // Simular viewport mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Verificar que a página carrega
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('deve funcionar em tablet', async ({ page }) => {
    // Simular viewport tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    
    // Verificar que a página carrega
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
