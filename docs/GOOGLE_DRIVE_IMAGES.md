# Imagens do Google Drive na descrição das seções

O editor de descrição das seções (página "Editar Seção") tem um botão **"Inserir do Google Drive"** na barra de ferramentas (logo após o ícone de inserir imagem por URL). O usuário escolhe uma imagem do próprio Drive e ela é inserida no texto em Markdown.

---

## Como o usuário final usa

1. Na edição da seção, clicar no ícone de Drive na barra do editor.
2. Na primeira vez, o Google pode pedir permissão para acessar o Drive (somente leitura).
3. Abre o **Google Picker**: o usuário seleciona uma imagem (PNG, JPEG, GIF, WebP, etc.).
4. O Markdown `![nome](url)` é inserido na posição do cursor.
5. A imagem aparece no preview e no documento **desde que** o arquivo no Drive esteja compartilhado como **"Qualquer pessoa com o link"**.

Há uma dica abaixo do editor lembrando do compartilhamento.

---

## Configuração passo a passo (quem instala o app)

Siga na ordem. Pode usar o **mesmo** cliente OAuth do "Login com Google" (Supabase) ou criar um novo.

### Passo 1: Google Cloud – ativar a API

1. Acesse [Google Cloud Console](https://console.cloud.google.com/).
2. Selecione o **projeto** (ex.: o mesmo do login do app).
3. No menu lateral: **APIs e serviços** → **Biblioteca**.
4. Pesquise por **"Google Picker API"**.
5. Clique na API → **Ativar**.

### Passo 2: Google Cloud – Origens JavaScript autorizadas

1. No menu lateral: **APIs e serviços** → **Credenciais**.
2. Na lista de credenciais, localize um **ID do cliente** do tipo **Aplicativo da Web** (o mesmo do login ou um novo).
   - **Usar o existente:** clique no **nome** desse ID do cliente.
   - **Criar novo:** **+ Criar credenciais** → **ID do cliente OAuth** → tipo **Aplicativo da Web** → dê um nome (ex.: "GDD Manager – Drive") e avance.
3. Na tela de edição/criação do cliente, encontre a seção **Origens JavaScript autorizadas**.
4. Clique em **+ Adicionar URI** e adicione **uma linha por URL**:
   - `http://localhost:3000` (desenvolvimento)
   - `https://SEU-DOMINIO.vercel.app` (substitua pelo domínio real do app no Vercel)
5. Clique em **Salvar** (no rodapé da página).

### Passo 2b: Conta em modo “Testes” – adicionar testadores

Se o seu projeto OAuth no Google Cloud estiver em **modo de testes** (o padrão antes da verificação da marca), só contas adicionadas como **testadores** podem ver a tela de consentimento e usar o Drive (e outros serviços como “Login com Google”).

1. No menu lateral: **APIs e serviços** → **Tela de consentimento do OAuth**.
2. Na seção **Testadores**, clique em **+ ADD USERS** / **Adicionar usuários**.
3. Adicione o e-mail de cada pessoa que vai usar o app (incluindo o seu).
4. Salve.

Quem instalar o GDD Manager e usar uma conta de testes do Google Cloud precisa adicionar manualmente os usuários aqui para eles terem acesso ao consentimento do Drive e, se for o caso, ao login com Google. Para uso público sem limite de usuários, é preciso enviar o app para [verificação da marca](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification) e mudar para **Produção**.

### Passo 3: Copiar o ID do cliente (valor da variável)

1. Ainda na tela do **ID do cliente** (Aplicativo da Web).
2. No topo da página aparece **ID do cliente**: um texto longo que termina em **`.apps.googleusercontent.com`**.
   - Exemplo: `123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com`
3. Clique no ícone de **copiar** ao lado desse valor e guarde em um lugar seguro.  
   **Esse é o valor** que você vai colar na variável de ambiente.

### Passo 4: Variável de ambiente no projeto

A variável deve se chamar **`NEXT_PUBLIC_GOOGLE_CLIENT_ID`** e o **valor** é exatamente o ID do cliente copiado no passo 3 (sem aspas, sem espaços).

#### Desenvolvimento local

1. Na raiz do projeto, abra (ou crie) o arquivo **`.env.local`**.
2. Adicione uma linha:
   ```env
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=COLE_AQUI_O_ID_DO_CLIENTE
   ```
3. Substitua `COLE_AQUI_O_ID_DO_CLIENTE` pelo valor copiado (ex.: `123456789012-xxx.apps.googleusercontent.com`).
4. Reinicie o servidor de desenvolvimento (`npm run dev`).

#### Produção (Vercel)

1. No [Vercel Dashboard](https://vercel.com/dashboard), abra o **projeto** do app.
2. **Settings** → **Environment Variables**.
3. **Key:** `NEXT_PUBLIC_GOOGLE_CLIENT_ID`  
   **Value:** o mesmo ID do cliente do passo 3 (cole o valor completo).
4. Escolha o ambiente (Production, Preview, Development) e salve.
5. Faça um **redeploy** para a variável passar a valer (Deployments → ⋮ no último deploy → Redeploy, ou um novo push). O app também usa a rota `GET /api/config/public` para ler o Client ID em runtime; assim, após o redeploy, o botão do Drive passa a funcionar mesmo que o build anterior não tivesse a variável.

### Resumo do valor da variável

| Onde configurar | Nome da variável | Valor |
|-----------------|------------------|--------|
| `.env.local` (local) e Vercel (produção) | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | O **ID do cliente** do aplicativo da Web (termina em `.apps.googleusercontent.com`), copiado em Credenciais no Google Cloud |

Se a variável não estiver definida, o botão do Drive ainda aparece; ao clicar, o usuário vê uma mensagem pedindo para configurar (texto em `sectionEdit.driveNotConfigured` nos locales).

---

## Segurança e privacidade

- O app **não** envia imagens para o nosso servidor: apenas insere um link para o Google Drive.
- O token é usado só no navegador para abrir o Picker (escopo somente leitura).
- Para a imagem ser visível para quem lê o documento, o arquivo no Drive precisa estar compartilhado como "Qualquer pessoa com o link".

---

## Referências

- [Google Picker API](https://developers.google.com/drive/picker/guides/overview)
- [Variáveis de ambiente no Vercel](https://vercel.com/docs/projects/environment-variables)  
- No próprio projeto: **`docs/ENV_VERCEL.md`** (lista de variáveis usadas pelo app, incluindo esta).
