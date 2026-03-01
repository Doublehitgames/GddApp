# 🌐 Localização (i18n) - Guia de Manutenção

## Objetivo

Este documento define como manter traduções no projeto sem alterar código da UI.

---

## Onde ficam as traduções

Arquivos de idioma:

- `locales/pt-BR.json` (idioma base)
- `locales/en.json`

A regra é simples: **todos os arquivos devem ter exatamente as mesmas chaves**.

---

## Fluxo recomendado para tradutores

1. Receber tarefa de revisão (ex.: inglês)
2. Editar apenas arquivo de idioma (`locales/en.json`)
3. Não alterar nomes de chave (somente os valores)
4. Rodar validação local:

```bash
npm run i18n:check
```

5. Abrir PR com título `docs(i18n): atualizar traduções en`

---

## Como adicionar novo idioma

Exemplo: `es`

1. Criar arquivo `locales/es.json` copiando a estrutura de `pt-BR.json`
2. Traduzir valores
3. Registrar locale em `lib/i18n/config.ts`
4. Incluir o locale no script `scripts/check-locales.ts`
5. Rodar:

```bash
npm run i18n:check
```

6. Validar app manualmente no idioma novo

---

## Qualidade e governança

- Idioma base: `pt-BR`
- Fallback padrão: `pt-BR`
- CI valida localizações automaticamente em PR/push via `npm run i18n:check`
- Não usar traduções vazias

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
