# Teste de diagnóstico: Supabase

Rota que compara **fetch direto** ao Supabase com o **cliente do app** para descobrir se o problema de sync é de conexão ou do nosso código.

## Como usar

1. **Faça login** no app (para ter sessão/cookies).
2. Com o dev server rodando (`npm run dev`), abra no navegador:
   ```
   http://localhost:3000/api/debug-supabase-test
   ```
3. A resposta é JSON. Leia o campo **`conclusion`** e os detalhes de **`directFetch`** e **`clientUpsert`**.

## Interpretação

| directFetch.ok | clientUpsert.success | Conclusão |
|----------------|----------------------|-----------|
| true           | true                 | Conexão e cliente OK. O problema está no fluxo ou no payload do sync (rota `/api/projects/sync`). |
| true           | false                | O Supabase responde bem ao fetch direto, mas o **cliente** falha (ex.: safeFetch tratando 204 como erro). |
| false          | -                    | Problema de **conexão**: URL, chave, projeto pausado, RLS ou gateway (502/503). Veja `directFetch.status` e `directFetch.bodyPreview`. |

- **directFetch**: resultado do `fetch()` nativo (sem cliente Supabase, sem safeFetch). Mostra o que o servidor realmente recebe do Supabase (status, content-type, corpo).
- **clientUpsert**: resultado do `supabase.from("projects").upsert()` (mesmo cliente da rota de sync). Se falhar, a mensagem vem em `clientUpsert.errorMessage`.

## Remover depois

A rota é só para diagnóstico. Pode remover a pasta `app/api/debug-supabase-test/` antes de ir para produção.
