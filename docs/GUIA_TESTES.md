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
# Todos os testes unitários (110 testes em ~1s)
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

Test Suites: 5 passed, 5 total
Tests:       110 passed, 110 total
Time:        1.14 s
```

- **PASS**: Todos os testes do arquivo passaram ✅
- **FAIL**: Algum teste falhou ❌
- **Tempo**: Quanto demorou (deve ser < 2s)

---

## Testes Unitários

### 1. Setup & Configuração (3 testes)

**Arquivo:** `__tests__/setup.test.ts`

**O que testa:**
- Validação da configuração do Jest
- Mocks de localStorage funcionando
- Mocks de window.matchMedia funcionando

**Para que serve:**
- Garante que o ambiente de testes está configurado corretamente
- Verifica que os mocks essenciais estão disponíveis

**Como executar:**
```bash
npm test -- setup
```

**O que esperar:**
- 3 testes simples que devem sempre passar
- Se falharem, há problema na configuração do Jest

---

### 2. ProjectStore (34 testes)

**Arquivo:** `__tests__/store/projectStore.test.ts`

**O que testa:**
Este é o coração da aplicação. Testa TODAS as operações do Zustand store.

#### addProject (3 testes)
```typescript
it('should add a new project')
it('should add multiple projects')
it('should persist project to localStorage')
```

**O que faz:** Verifica criação de projetos
**Por que importa:** Sem isso, nenhum projeto seria criado
**Como testar manualmente:** Criar projeto na UI e ver se aparece

#### getProject (2 testes)
```typescript
it('should return project by id')
it('should return undefined for non-existent project')
```

**O que faz:** Busca projeto por ID
**Por que importa:** Necessário para abrir/editar projetos
**Como testar manualmente:** Clicar em um projeto na lista

#### editProject (2 testes)
```typescript
it('should edit project name and description')
it('should update updatedAt timestamp')
```

**O que faz:** Edita informações do projeto
**Por que importa:** Usuário precisa atualizar nome/descrição
**Como testar manualmente:** Editar projeto existente

#### removeProject (2 testes)
```typescript
it('should remove project by id')
it('should not affect other projects')
```

**O que faz:** Deleta projeto
**Por que importa:** Limpar projetos não utilizados
**Como testar manualmente:** Deletar projeto e verificar que sumiu

#### addSection (3 testes)
```typescript
it('should add a root section to project')
it('should add multiple sections with correct order')
it('should set default empty content if not provided')
```

**O que faz:** Adiciona seção raiz ao projeto
**Por que importa:** Estrutura principal do GDD
**Como testar manualmente:** Adicionar nova seção em um projeto

#### addSubsection (2 testes)
```typescript
it('should add subsection to parent section')
it('should handle multiple subsections with correct order')
```

**O que faz:** Adiciona subseção (filho) de outra seção
**Por que importa:** Hierarquia de seções (ex: Mecânicas > Combate > Sistema de Dano)
**Como testar manualmente:** Adicionar subseção dentro de uma seção

#### editSection (1 teste)
```typescript
it('should edit section title and content')
```

**O que faz:** Edita título e conteúdo de seção
**Por que importa:** Atualizar informações das seções
**Como testar manualmente:** Editar seção existente

#### removeSection (2 testes)
```typescript
it('should remove section from project')
it('should not remove subsections automatically')
```

**O que faz:** Remove seção
**Por que importa:** Limpar seções não necessárias
**Nota:** Não remove subseções automaticamente (design choice)

#### moveSectionUp/Down (4 testes)
```typescript
it('should move section up in order')
it('should not move first section up')
it('should move section down in order')
it('should not move last section down')
```

**O que faz:** Move seções para cima/baixo na lista
**Por que importa:** Reorganizar ordem das seções
**Como testar manualmente:** Usar botões ↑↓ nas seções

#### reorderSections (1 teste)
```typescript
it('should reorder sections based on array of IDs')
```

**O que faz:** Reordena múltiplas seções de uma vez
**Por que importa:** Usado pelo drag & drop
**Como testar manualmente:** Arrastar seções para reordenar

#### countDescendants (2 testes)
```typescript
it('should count all descendants recursively')
it('should return 0 for section with no descendants')
```

**O que faz:** Conta todos os filhos/netos de uma seção
**Por que importa:** Mostrar "X subseções" na UI
**Como testar manualmente:** Ver contador de subseções

#### hasDuplicateName (4 testes)
```typescript
it('should detect duplicate section names at same level')
it('should be case insensitive')
it('should allow same name in different levels')
it('should exclude current section when editing')
```

**O que faz:** Valida se nome de seção já existe
**Por que importa:** Evitar confusão com seções de mesmo nome
**Como testar manualmente:** Tentar criar seção com nome duplicado

#### loadFromStorage (3 testes)
```typescript
it('should load projects from localStorage')
it('should handle empty localStorage')
it('should migrate old projects without timestamps')
```

**O que faz:** Carrega dados salvos do navegador
**Por que importa:** Persistência entre sessões
**Como testar manualmente:** Recarregar página e ver projetos

#### importProject (2 testes)
```typescript
it('should import a new project')
it('should replace existing project with same ID')
```

**O que faz:** Importa projeto de backup
**Por que importa:** Restaurar backups
**Como testar manualmente:** Usar funcionalidade de import

#### importAllProjects (1 teste)
```typescript
it('should replace all projects with imported ones')
```

**O que faz:** Importa múltiplos projetos
**Por que importa:** Restaurar backup completo
**Como testar manualmente:** Importar arquivo JSON completo

**Como executar:**
```bash
npm test -- projectStore
```

**O que esperar:**
- 34 testes devem passar
- Tempo: ~600ms
- Se falhar: problema crítico no store (coração da app)

---

### 3. Referências Cruzadas (38 testes)

**Arquivo:** `__tests__/utils/sectionReferences.test.ts`

**O que testa:**
Sistema de links entre seções usando sintaxe `$[Nome da Seção]` ou `$[#id]`

#### extractSectionReferences (7 testes)

**O que faz:** Encontra todas as referências no texto markdown

Exemplos:
```markdown
Veja $[Game Mechanics] para mais detalhes
Check $[#section-123] também
```

Testes:
```typescript
it('should extract name-based references')  // $[Nome]
it('should extract ID-based references')    // $[#id]
it('should extract multiple references')
it('should handle references with spaces')
it('should return empty array for no references')
it('should handle empty content')
it('should extract references in markdown formatted text')
```

**Por que importa:** Base do sistema de referências cruzadas

#### findSection (6 testes)

**O que faz:** Busca seção por nome ou ID

Testes:
```typescript
it('should find section by name (case-insensitive)')
it('should find section by exact name')
it('should find section by ID')
it('should return null for non-existent name')
it('should return null for non-existent ID')
it('should handle names with extra spaces')
```

**Por que importa:** Resolver referências para links clicáveis

#### convertReferencesToIds (7 testes)

**O que faz:** Converte `$[Nome]` → `$[#id]`

Por exemplo:
- Input: `Veja $[Combat System]`
- Output: `Veja $[#abc-123]`

**Por que importa:** IDs são estáveis, nomes podem mudar

Testes:
```typescript
it('should convert name references to ID references')
it('should convert multiple name references')
it('should keep ID references unchanged')
it('should handle mixed references')
it('should not modify references to non-existent sections')
it('should handle empty content')
it('should preserve text around references')
```

#### convertReferencesToNames (5 testes)

**O que faz:** Converte `$[#id]` → `$[Nome]` (inverso)

**Por que importa:** Editor fica mais amigável mostrando nomes

#### validateReferences (5 testes)

**O que faz:** Separa referências válidas e inválidas

Exemplo:
```markdown
$[Exists]     ← válida
$[NotFound]   ← inválida
```

**Por que importa:** Mostrar erros de referências quebradas

#### getBacklinks (6 testes)

**O que faz:** Encontra quem referencia uma seção

Se "Combat" é referenciada em "Weapons" e "Tutorial":
```javascript
getBacklinks('combat-id') 
// Retorna: [{ id: 'weapons-id', title: 'Weapons' }, ...]
```

**Por que importa:** Ver onde uma seção é mencionada

#### Integration Tests (2 testes)

**O que faz:** Testa conversão round-trip (nome→id→nome)

**Por que importa:** Garantir que conversões não perdem informação

**Como executar:**
```bash
npm test -- sectionReferences
```

**O que esperar:**
- 38 testes devem passar
- Tempo: ~600ms
- Falhas indicam problema no sistema de referências cruzadas

---

### 4. Componente SectionLink (14 testes)

**Arquivo:** `__tests__/components/SectionLink.test.tsx`

**O que testa:**
Componente React que renderiza links entre seções

#### Valid Section Link (5 testes)

**Cenário:** Link para seção que existe

```tsx
<SectionLink 
  sectionName="Combat" 
  projectId="proj-1" 
  sectionId="sect-123"
>
  Combat System
</SectionLink>
```

Renderiza: `<button>` azul clicável

Testes:
```typescript
it('should render as a clickable button when sectionId exists')
it('should have correct title attribute')
it('should navigate to correct URL when clicked')
it('should prevent default event behavior')
it('should render children content')
```

**Como testar manualmente:** Clicar em referência no documento

#### Invalid Section Link (5 testes)

**Cenário:** Link para seção que NÃO existe

```tsx
<SectionLink 
  sectionName="Deleted Section" 
  projectId="proj-1" 
  sectionId={null}
>
  Deleted Section
</SectionLink>
```

Renderiza: `<span>` vermelho com linha ondulada

Testes:
```typescript
it('should render as span when sectionId is null')
it('should have error styling when sectionId is null')
it('should show error message in title')
it('should not navigate when clicked if sectionId is null')
it('should render children even when invalid')
```

**Como testar manualmente:** Deletar seção e ver referências quebradas

#### Different Content Types (2 testes)

**O que faz:** Testa diferentes tipos de children (texto, JSX)

#### Accessibility (2 testes)

**O que faz:** Verifica acessibilidade (teclado, hover)

**Como executar:**
```bash
npm test -- SectionLink
```

**O que esperar:**
- 14 testes devem passar
- Tempo: ~800ms
- Falhas indicam problema visual ou de navegação

---

### 5. API de Upload (21 testes)

**Arquivo:** `__tests__/api/upload.test.ts`

**O que testa:**
Validações da API de upload de imagens (sem testar filesystem)

#### File Type Validation (3 testes)

**O que valida:**
```javascript
allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
```

Testes:
```typescript
it('should accept valid image types')
it('should reject non-image types')  // PDF, ZIP, MP4, etc
it('should handle case sensitivity correctly')
```

**Por que importa:** Evitar upload de arquivos não suportados

#### File Size Validation (3 testes)

**O que valida:**
- Máximo: 5MB
- Rejeitar: > 5MB

**Por que importa:** Evitar uploads gigantes

#### Filename Sanitization (4 testes)

**O que faz:** Remove caracteres especiais de nomes de arquivo

Exemplos:
```
"file name.png" → "file_name.png"
"file@#$.jpg"   → "file___.jpg"
```

**Por que importa:** Evitar problemas com caracteres especiais no filesystem

#### URL Path Generation (3 testes)

**O que faz:** Gera URL pública do arquivo

```javascript
projectId = "proj-123"
filename = "1234-image.png"
url = "/uploads/proj-123/1234-image.png"
```

**Por que importa:** Imagem precisa ser acessível via URL

#### Request Validation (3 testes)

**O que valida:**
- `file` é obrigatório
- `projectId` é obrigatório

#### Timestamp Generation (2 testes)

**O que faz:** Gera timestamps únicos para nomes de arquivo

#### Error Scenarios (3 testes)

**O que valida:** Diferentes cenários de erro

**Como executar:**
```bash
npm test -- upload
```

**O que esperar:**
- 21 testes devem passar
- Tempo: ~200ms
- Falhas indicam problema nas validações de upload

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

### Testes Implementados (10 testes)

**Arquivo:** `e2e/gdd-manager.spec.ts`

#### Fluxo Principal (5 testes)

```typescript
test('deve carregar a página inicial')
```
**O que faz:** Abre http://localhost:3000 e verifica que carregou
**Por que importa:** Primeira coisa que usuário vê

```typescript
test('deve criar um novo projeto')
```
**O que faz:** 
1. Clica em "Novo Projeto"
2. Preenche título e descrição
3. Salva
4. Verifica que aparece na lista

**Por que importa:** Funcionalidade principal

```typescript
test('deve adicionar uma seção ao projeto')
```
**O que faz:**
1. Cria projeto
2. Abre projeto
3. Adiciona seção
4. Verifica que aparece

**Por que importa:** Segunda funcionalidade mais importante

```typescript
test('deve navegar entre páginas')
```
**O que faz:** Testa navegação (home → backup → home)

```typescript
test('deve persistir dados após recarregar página')
```
**O que faz:**
1. Cria projeto
2. Recarrega página (F5)
3. Verifica que projeto ainda existe

**Por que importa:** Dados não podem sumir ao recarregar

#### Edição de Conteúdo (1 teste)

```typescript
test('deve editar nome do projeto')
```
**O que faz:** Edita projeto existente

#### Funcionalidade de IA (1 teste)

```typescript
test('deve navegar para página de criação com IA')
```
**O que faz:** Verifica navegação para /ai-create

#### Responsividade (2 testes)

```typescript
test('deve funcionar em mobile')    // 375x667
test('deve funcionar em tablet')    // 768x1024
```

**O que faz:** Simula diferentes tamanhos de tela

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
