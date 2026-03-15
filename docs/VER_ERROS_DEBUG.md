# Como ver erros de sync / debug

## 1. Mensagem na tela

- Vá em **Configurações → Persistência** (ou `/settings/persistence`).
- Se o sync falhar, aparecem **Último erro** e (se for diferente) **Última falha (técnica)**.
- Abaixo há uma dica: **F12 → Aba Rede → clique na requisição "sync" com status 500 → Aba Resposta.**  
  Aí você vê o JSON que a API devolve (`error`, `code`, `details`, `hint` e em dev também `debug`).

## 2. Resposta completa da API (Network)

1. Abra as **Ferramentas do desenvolvedor** (F12).
2. Vá na aba **Rede** (ou **Network**).
3. Dispare o sync (edite algo no projeto ou use "Sincronizar agora").
4. Clique na requisição que vai para `sync` e fica **vermelha** (status 500).
5. Abra a aba **Resposta** (ou **Response**).  
   O texto é o corpo da API: `error` (mensagem), `code`, `details`, `hint` e, em desenvolvimento, `debug` (objeto de erro completo em JSON).

## 3. Terminal (logs do servidor)

O servidor Next.js escreve erros no **terminal onde você rodou o app** (por exemplo onde executou `npm run dev`).

- **Onde fica:** a janela do terminal (PowerShell, CMD, etc.) onde aparecem as linhas tipo `[api/projects/sync] ... err:`.
- **O que fazer:** deixe essa janela visível enquanto testa; quando der 500, olhe as linhas que aparecem logo depois da requisição.  
  Se não aparecer nada, use o método da aba **Rede** (item 2) e leia o campo **Resposta** (e `debug` em dev).
