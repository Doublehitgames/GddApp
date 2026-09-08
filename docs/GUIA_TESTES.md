# 🧪 Guia Detalhado de Testes

## 📚 Índice

1. [Introdução](#introdução)
2. [Como Executar os Testes](#como-executar-os-testes)
3. [Testes Unitários](#testes-unitários)
4. [Testes E2E](#testes-e2e)
5. [Escrevendo Novos Testes](#escrevendo-novos-testes)
6. [Troubleshooting](#troubleshooting)

---

## Introdução

### O que são testes automatizados?

Testes automatizados são scripts que validam se o código funciona corretamente. Eles:
- ✅ Verificam se funções retornam os valores esperados
- ✅ Garantem que componentes renderizam corretamente
- ✅ Detectam bugs antes dos usuários
- ✅ Documentam como o código deve funcionar
- ✅ Permitem refatorar com segurança

### Por que temos testes?

**Confiança:** Sabemos que o código funciona
**Velocidade:** 1 segundo vs 15 minutos de teste manual
**Documentação:** Testes mostram como usar cada função
**Prevenção:** Bugs são detectados automaticamente

---

## Como Executar os Testes

### Comandos Básicos

```bash
# Todos os testes unitários
npm test

# Modo watch - re-executa automaticamente ao salvar arquivos
npm run test:watch

# Com relatório de cobertura de código
npm run test:coverage

# Apenas um arquivo específico
npm test -- projectStore
npm test -- SectionLink

# Testes E2E (end-to-end)
npm run test:e2e

# E2E Smoke (rápidos)
npm run test:e2e:smoke

# E2E Critical (fluxos críticos de sync)
npm run test:e2e:critical

# E2E com interface visual
npm run test:e2e:ui

# Ver relatório dos testes E2E
npm run test:e2e:report
```

### Interpretando os Resultados

```
PASS  __tests__/store/projectStore.test.ts
  ProjectStore
    addProject
      ✓ should add a new project (3 ms)
      ✓ should add multiple projects (1 ms)

Test Suites: <N> passed, <N> total
Tests:       <N> passed, <N> total
Time:        <N> s
```

- **PASS**: Todos os testes do arquivo passaram ✅
- **FAIL**: Algum teste falhou ❌
- **Total**: a contagem muda a cada feature. O que importa é que o número de
  `failed` seja zero, não que bata com algum número anotado numa doc.

---

## Testes Unitários

As suítes vivem em `__tests__/`, espelhando a estrutura do código:

| Pasta | O que cobre |
|---|---|
| `__tests__/store/` | store Zustand: CRUD de projeto e seção, sync, limites do dono, refs em rename, log de atividade |
| `__tests__/lib/` | API v1, MCP (os dois servidores), changelog, status de página, chaves de API, Drive, richDoc |
| `__tests__/utils/` | referências cruzadas, import de docx/markdown, prompts de IA, texto de busca |
| `__tests__/components/` | componentes com lógica de verdade (biblioteca de imagens, link de seção, picker) |
| `__tests__/api/` | rotas de API |

**Este guia não lista as suítes uma por uma de propósito.** A lista anterior
envelheceu em semanas: virou um inventário de 7 arquivos num projeto com dezenas,
com contagens que nunca batiam. Para ver o que existe agora:

```bash
npx jest --listTests          # todos os arquivos de teste
npm test -- <parte-do-nome>   # roda só o que casa com o nome
npm run test:coverage         # o que está coberto e o que não está
```

O nome do arquivo diz o que ele cobre, e o `describe` de cima diz o resto.
Ao mexer em **sync ou quota**, os que importam são
`__tests__/store/projectStore*.test.ts` e `__tests__/lib/projectSync.test.ts`.
Ao mexer em **tool de MCP**, `__tests__/lib/mcp.*.test.ts` — dois deles comparam
as duas cópias do servidor byte a byte, então falham se você atualizar só uma.

---

## Testes E2E

### O que são testes E2E?

**E2E = End-to-End** (ponta a ponta)

Testes que simulam um usuário real usando a aplicação:
1. Abre o navegador
2. Navega pelas páginas
3. Clica em botões
4. Preenche formulários
5. Verifica se tudo funciona

### Playwright

Usamos **Playwright** para testes E2E. Ele:
- Abre um navegador real (Chromium/Firefox/WebKit)
- Simula interações de usuário
- Tira screenshots de falhas
- Gera vídeos dos testes

### Suítes E2E

| Arquivo | Tag | O que cobre |
|---|---|---|
| `e2e/smoke-ui.spec.ts` | `@smoke` | a home carrega e a criação manual de projeto abre |
| `e2e/sync-critical.spec.ts` | `@critical` | sync sai sem refresh depois de criar projeto e páginas; dado local sobrevive a reload |

São poucos e de propósito: E2E é caro de manter, então cobre só o que quebra
silencioso e machuca — o sync e a porta de entrada do app. O resto fica com
teste unitário.

Dois detalhes que fazem os E2E deste repo passarem:

- **Cookie de locale**: os testes setam `gdd_locale=pt-BR` para que os
  placeholders venham em português; sem isso, os seletores por texto falham
  dependendo do idioma do navegador.
- **Sync em payloads separados**: o debounce pode dividir uma edição em mais de
  uma requisição, então esperar por um número exato de requests é frágil — usar
  `expect.poll`. E depois de clique que navega, `waitForURL` antes da asserção.


### Como Executar E2E

```bash
# Rodar todos os testes E2E
npm run test:e2e

# Modo UI (interativo - RECOMENDADO para debug)
npm run test:e2e:ui

# Ver relatório HTML
npm run test:e2e:report
```

**Nota:** E2E inicia o servidor automaticamente (porta 3000)

### O que Esperar

- **Tempo:** ~30-60 segundos (muito mais lento que unitários)
- **Navegador:** Abre e fecha automaticamente
- **Screenshots:** Salvos em `test-results/` se falhar
- **Relatório:** HTML em `playwright-report/`

### Quando Rodar E2E?

- ✅ Antes de fazer deploy
- ✅ Após mudanças grandes na UI
- ✅ Periodicamente (1x por semana)
- ❌ Não rodar a cada mudança pequena (muito lento)

---

## Escrevendo Novos Testes

### Anatomia de um Teste

```typescript
describe('Nome do Grupo', () => {
  it('should do something', () => {
    // Arrange - Preparar
    const input = 'test'
    
    // Act - Executar
    const result = myFunction(input)
    
    // Assert - Verificar
    expect(result).toBe('expected')
  })
})
```

### Teste de Função Simples

```typescript
// utils/math.ts
export function sum(a: number, b: number) {
  return a + b
}

// __tests__/utils/math.test.ts
import { sum } from '@/utils/math'

describe('sum', () => {
  it('should add two numbers', () => {
    expect(sum(2, 3)).toBe(5)
  })

  it('should handle negative numbers', () => {
    expect(sum(-1, 1)).toBe(0)
  })
})
```

### Teste de Componente React

```typescript
import { render, screen } from '@testing-library/react'
import { MyButton } from '@/components/MyButton'

describe('MyButton', () => {
  it('should render text', () => {
    render(<MyButton>Click me</MyButton>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('should call onClick when clicked', () => {
    const handleClick = jest.fn()
    render(<MyButton onClick={handleClick}>Click</MyButton>)
    
    screen.getByText('Click').click()
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

### Teste de Store (Zustand)

```typescript
import { useMyStore } from '@/store/myStore'

describe('myStore', () => {
  beforeEach(() => {
    // Resetar estado antes de cada teste
    useMyStore.setState({ items: [] })
  })

  it('should add item', () => {
    useMyStore.getState().addItem('test')
    
    const items = useMyStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0]).toBe('test')
  })
})
```

### Boas Práticas

#### ✅ DO

- Teste comportamento, não implementação
- Um conceito por teste
- Nomes descritivos: `should do X when Y`
- Arrange-Act-Assert (AAA pattern)
- Isolar testes (não dependem um do outro)
- Usar `beforeEach` para setup

#### ❌ DON'T

- Não teste detalhes de implementação
- Não faça testes dependentes de ordem
- Não teste código de terceiros (libs)
- Não deixe testes lentos (mock de APIs)
- Não deixe testes flaky (as vezes passa, as vezes falha)

---

## Troubleshooting

### Problema: Testes falham com "localStorage is not defined"

**Solução:** Verificar `jest.setup.ts` tem mock do localStorage

```typescript
// jest.setup.ts
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
global.localStorage = localStorageMock as any
```

### Problema: "Cannot find module '@/...'"

**Solução:** Verificar `jest.config.ts` tem moduleNameMapper

```typescript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/$1',
}
```

### Problema: Testes de componente falham com "useRouter is not defined"

**Solução:** Mock do Next.js router

```typescript
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    back: jest.fn(),
  })),
}))
```

### Problema: E2E falha com "timeout waiting for page"

**Solução:** Aumentar timeout no playwright.config.ts ou verificar se servidor iniciou

### Problema: Testes ficam muito lentos

**Possíveis causas:**
- Muitos testes E2E (normais são lentos)
- Não está usando mocks (chamando APIs reais)
- Componentes pesados sem lazy loading

**Soluções:**
- Separar E2E dos unitários
- Mockar APIs externas
- Usar `test.only` para rodar apenas um teste durante debug

### Problema: "Test suite failed to run" com erro de import

**Solução:** Verificar que arquivo existe e path está correto

---

## Recursos Adicionais

### Documentação Oficial

- [Jest](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright](https://playwright.dev/docs/intro)

### Cheat Sheets

#### Jest Matchers

```typescript
expect(value).toBe(5)                    // igualdade estrita
expect(value).toEqual({ a: 1 })          // igualdade profunda
expect(value).toBeTruthy()               // truthy
expect(value).toBeFalsy()                // falsy
expect(array).toHaveLength(3)            // tamanho de array
expect(string).toContain('text')         // substring
expect(fn).toHaveBeenCalled()            // função foi chamada
expect(fn).toHaveBeenCalledWith('arg')   // chamada com argumento
```

#### Testing Library Queries

```typescript
screen.getByText('text')                 // por texto exato
screen.getByRole('button')               // por role ARIA
screen.getByLabelText('Email')           // por label de form
screen.getByTestId('my-element')         // por data-testid
screen.queryByText('text')               // retorna null se não achar
```

### Debug de Testes

```typescript
// Ver o HTML renderizado
import { screen } from '@testing-library/react'
screen.debug()  // imprime HTML no console

// Pausar execução
test('debug', () => {
  debugger  // abre DevTools
})

// Rodar apenas um teste
test.only('this one', () => {
  // apenas este roda
})
```

---

## Conclusão

Testes são um investimento que se paga rapidamente:

- **Tempo inicial:** 6 horas de setup
- **Tempo economizado:** 10 minutos por mudança
- **Break-even:** ~40 mudanças no código
- **Benefício:** Confiança infinita para evoluir

**Mantenha os testes atualizados e eles vão te salvar de muita dor de cabeça! 🚀**
