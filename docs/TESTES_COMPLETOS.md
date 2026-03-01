# ✅ Sistema de Testes - Estado Atual

## Resumo

- Unitários/Jest: 118 testes
- E2E/Playwright: 4 testes (2 smoke + 2 critical)
- Build de produção: validado com `npm run build`
- TypeScript: validado com `npx tsc --noEmit`

---

## Suites unitárias

- `__tests__/setup.test.ts`
- `__tests__/store/projectStore.test.ts`
- `__tests__/store/projectStore.sync.test.ts`
- `__tests__/lib/projectSync.test.ts`
- `__tests__/utils/sectionReferences.test.ts`
- `__tests__/components/SectionLink.test.tsx`
- `__tests__/api/upload.test.ts`

---

## Suites E2E

- `e2e/smoke-ui.spec.ts` (`@smoke`)
- `e2e/sync-critical.spec.ts` (`@critical`)

---

## Comandos recomendados

```bash
# Type safety
npx tsc --noEmit

# Unitários
npm test

# E2E completo
npm run test:e2e

# E2E por foco
npm run test:e2e:smoke
npm run test:e2e:critical

# Build de produção
npm run build
```

---

## Pipeline CI esperado

1. `npm ci`
2. `npx tsc --noEmit`
3. `npm test -- --coverage --watchAll=false`
4. `npx playwright install --with-deps chromium`
5. `npm run test:e2e`

---

## Critério de liberação

Para liberar versão em produção:

- Todos os comandos acima devem passar
- Fluxo manual crítico deve ser validado:
  - login
  - criar projeto
  - criar seção/subseção
  - confirmar persistência cloud sem refresh
