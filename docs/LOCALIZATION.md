# 🌐 Localização (i18n) - Guia de Manutenção

## Objetivo

Este documento define como manter traduções no projeto sem alterar código da UI.

---

## Onde ficam as traduções

Arquivos de idioma:

- `locales/pt-BR.json` (idioma base)
- `locales/en.json`
- `locales/es.json`

A regra é simples: **todos os arquivos devem ter exatamente as mesmas chaves**.

---

## Fluxo recomendado para tradutores

1. Receber tarefa de revisão (ex.: inglês)
2. Editar apenas arquivo de idioma (`locales/en.json`)
3. Não alterar nomes de chave (somente os valores)
4. Rodar validação local:

```bash
npm run i18n:validate
```

5. Abrir PR com título `docs(i18n): atualizar traduções en`

---

## Como adicionar novo idioma

Exemplo: `es`

1. Criar arquivo `locales/es.json` copiando a estrutura de `pt-BR.json`
2. Traduzir valores
3. Registrar locale em `lib/i18n/config.ts`
4. Rodar:

```bash
npm run i18n:validate
```

5. Validar app manualmente no idioma novo

---

## Qualidade e governança

- Idioma base: `pt-BR`
- Fallback padrão: `pt-BR`
- CI/local valida localizações automaticamente via `npm run i18n:validate`
- Não usar traduções vazias

### O que `i18n:validate` checa

1. `i18n:check`
	- paridade de chaves entre todos os arquivos de locale
	- campos `meta.languageName` e `meta.locale` válidos
	- `meta.locale` igual ao nome do arquivo
	- ausência de traduções vazias (inclusive no idioma base)

2. `i18n:audit`
	- bloqueia padrões de hardcode de idioma no código (ex.: `locale === "pt-BR"`, `isPt ? ...`, `toLocale...("pt-BR")`)
	- funciona em modo baseline: bloqueia regressões novas sem travar por dívida histórica

### Baseline de auditoria

- Arquivo: `scripts/i18n-hardcode-baseline.json`
- Atualizar baseline (somente quando intencional):

```bash
npm run i18n:audit:update-baseline
```

- Regra recomendada para time/CI:
  - `npm run i18n:validate` deve passar em todo PR
  - não atualizar baseline para “mascarar” regressão sem revisão técnica

---

## Convenção de chaves

Use nomes por domínio:

- `common.*`
- `auth.*`
- `projects.*`
- `settings.*`

Exemplo:

- `auth.login.title`
- `projects.emptyState`
- `common.save`

---

## Notas práticas

- Tradutor deve editar texto, não estrutura.
- Novas chaves devem ser criadas primeiro no idioma base (`pt-BR`).
- Se faltar tradução em idioma secundário, o app usa fallback.
- Em componentes, priorize sempre `t("namespace.key")` em vez de ternários locais por idioma.
