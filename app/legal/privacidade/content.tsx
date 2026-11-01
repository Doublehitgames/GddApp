import type { ReactNode } from "react";
import Link from "next/link";
import { LegalCallout, LegalSection } from "@/components/legal/LegalArticle";
import type { AppLocale } from "@/lib/i18n/config";
import { LEGAL_CONTACT_EMAIL, LEGAL_OPERATOR, LEGAL_OPERATOR_URL, legalHref } from "@/lib/legal/pages";

/*
 * Texto da política nos três idiomas. Inventário de onde cada afirmação vem:
 *  - conta / perfil ............ lib/supabase/schema.sql (profiles, handle_new_user), store/authStore.ts
 *  - IA com a chave da pessoa .. hooks/useAIConfig.ts (profiles.ai_config + localStorage), utils/ai/*
 *  - sync ...................... app/api/projects/sync/route.ts, store/slices/types.ts (syncAutomatic: false)
 *  - histórico / atividade ..... add_section_versions.sql, add_section_activity_log.sql (90 dias / 200)
 *  - chaves e OAuth ............ schema.sql (user_api_keys), add_oauth_mcp.sql, lib/oauth.ts (TTLs)
 *  - Drive ..................... lib/googleDriveFolder.ts, lib/googleDrivePicker.ts (token só no navegador)
 *  - cookies ................... proxy.ts / lib/supabase/server.ts (sessão), lib/i18n/provider.tsx (gdd_locale)
 *  - região .................... vercel.json (iad1), Supabase us-east-1
 * Nenhum pacote de analytics, rastreio ou anúncio no package.json.
 */

function Mail() {
  return <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>;
}

/** Tabela compacta "dado → para quê → onde fica", com cores de token. */
function DataTable({ head, rows }: { head: [string, string, string]; rows: [ReactNode, ReactNode, ReactNode][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full min-w-[560px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-muted">
            {head.map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-line align-top last:border-b-0">
              <td className="px-3 py-2.5 font-medium text-ink">{row[0]}</td>
              <td className="px-3 py-2.5 text-ink-2">{row[1]}</td>
              <td className="px-3 py-2.5 text-muted">{row[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ pt-BR */

function BodyPt() {
  return (
    <>
      <LegalCallout>
        <strong>Em resumo:</strong> seus projetos vivem primeiro no seu navegador. Só vão para a nuvem quando você
        sincroniza, e lá ficam visíveis só para você e para quem você convidar. Guardamos o mínimo para a sua conta
        funcionar, não vendemos nada, não mostramos anúncio e não usamos ferramenta de rastreio. Você pode pedir uma
        cópia de tudo ou apagar tudo quando quiser.
      </LegalCallout>

      <LegalSection title="Quem cuida dos seus dados">
        <p>
          O GDD Manager é mantido pela <a href={LEGAL_OPERATOR_URL} target="_blank" rel="noopener noreferrer"><strong>{LEGAL_OPERATOR}</strong></a>, que é a responsável (a &quot;controladora&quot;,
          na linguagem da LGPD) pelos dados tratados aqui. Para qualquer assunto de privacidade — dúvida, pedido ou
          reclamação — o canal é um só: <Mail />. Esse mesmo endereço é o contato do encarregado pelo tratamento de
          dados.
        </p>
      </LegalSection>

      <LegalSection title="O que fica só no seu navegador">
        <p>
          O GDD foi feito para funcionar mesmo sem internet. Por isso, tudo o que você escreve é salvo primeiro no
          armazenamento local do seu navegador, neste aparelho: os projetos e as páginas, as configurações de
          sincronização, o tema (claro ou escuro), o idioma e algumas preferências de tela.
        </p>
        <p>
          Isso não sai do seu computador por conta própria. Se você limpar os dados do navegador, essa cópia local
          some — por isso vale sincronizar ou exportar o que é importante.
        </p>
      </LegalSection>

      <LegalSection title="O que guardamos na nuvem">
        <p>
          A sincronização com a nuvem é manual por padrão: um projeto só vai para os nossos servidores quando você
          clica em sincronizar, ou quando você mesmo liga a sincronização automática nas configurações. A tabela abaixo
          mostra tudo o que pode ficar guardado do nosso lado.
        </p>
        <DataTable
          head={["Dado", "Para quê", "Onde fica"]}
          rows={[
            [
              "E-mail, nome de exibição e senha",
              "Criar a conta, entrar e mostrar quem é você. A senha é guardada pelo serviço de login de forma cifrada; nós nunca a vemos.",
              "Supabase (EUA)",
            ],
            [
              "Nome, e-mail e foto do Google",
              "Quando você entra com o Google, ele nos devolve só isso. Serve para criar a conta e preencher seu nome.",
              "Supabase (EUA)",
            ],
            [
              "Projetos sincronizados",
              "Título, visão do jogo, páginas e seus textos, tabelas, fluxogramas, capa, andamento, links de imagem e as instruções para IA do projeto. Serve para abrir em outro aparelho e trabalhar em equipe.",
              "Supabase (EUA)",
            ],
            [
              "Histórico das páginas",
              "Cada versão salva do título e do texto de uma página, com o nome de quem editou. Alimenta o \"O que mudou\" e permite restaurar.",
              "Supabase (EUA)",
            ],
            [
              "Registro de atividade",
              "Página criada, apagada ou renomeada, com o nome de quem fez. Mostra à equipe o que aconteceu.",
              "Supabase (EUA)",
            ],
            [
              "Membros do projeto",
              "Quem foi convidado, com qual papel (editor ou leitor) e por quem.",
              "Supabase (EUA)",
            ],
            [
              "Uso da sincronização",
              "Quantos créditos de sincronização você usou em cada hora, para aplicar os limites do plano.",
              "Supabase (EUA)",
            ],
            [
              "Configuração de IA",
              "O provedor escolhido, o modelo e a chave que você colou. Serve para os recursos de IA funcionarem em qualquer aparelho.",
              "Seu perfil no Supabase (EUA) e o seu navegador",
            ],
            [
              "Chaves de acesso e conexões de agentes",
              "Nome, começo da chave e data do último uso. A chave inteira e os tokens de conexão nunca são guardados — só uma impressão digital deles, que não permite reconstruí-los.",
              "Supabase (EUA)",
            ],
            [
              "Projetos apagados",
              "Só o identificador e a data, para que uma cópia antiga em outro aparelho não traga o projeto de volta.",
              "Supabase (EUA)",
            ],
          ]}
        />
        <p>
          Não guardamos arquivos de imagem: uma imagem dentro de uma página é sempre um link para onde ela já está
          (o seu Google Drive, por exemplo).
        </p>
      </LegalSection>

      <LegalSection title="Login com o Google e a pasta do Google Drive">
        <p>
          <strong>Entrar com o Google</strong> pede só o básico: seu nome, seu e-mail e sua foto de perfil. Não temos
          acesso à sua senha do Google nem a mais nada da sua conta por causa do login.
        </p>
        <p>
          <strong>A biblioteca de imagens</strong> é separada e opcional. Quando você escolhe uma imagem ou uma pasta
          do Drive, o Google pede uma permissão de <em>leitura</em> dos seus arquivos. Com ela, o GDD faz, a partir do
          seu próprio navegador:
        </p>
        <ul>
          <li>a janela de escolha de arquivos do Google, para você apontar uma imagem ou uma pasta;</li>
          <li>a leitura da lista de imagens da pasta escolhida e das subpastas dela (nome, identificador e caminho de cada uma).</li>
        </ul>
        <p>
          Essa lista é salva no projeto, para mostrar a biblioteca sem pedir permissão de novo. O acesso que o Google
          concede fica só na memória do navegador enquanto a aba está aberta: ele não é enviado aos nossos servidores e
          não é guardado. O GDD nunca altera, apaga ou envia arquivos para o seu Drive, e não lê nada fora da pasta que
          você escolheu.
        </p>
        <p>
          O uso que o GDD faz das informações recebidas das APIs do Google segue a{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
            Política de Dados do Usuário dos Serviços de API do Google
          </a>
          , incluindo os requisitos de Uso Limitado. Em palavras simples: esses dados servem só para mostrar as suas
          imagens no GDD; não são vendidos, não viram anúncio, não treinam IA e ninguém da equipe os lê, salvo se você
          pedir ajuda, por segurança ou por exigência da lei.
        </p>
        <p>
          Você pode tirar essa permissão a qualquer momento em{" "}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
            myaccount.google.com/permissions
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Recursos de IA">
        <p>
          A IA do GDD ajuda a escrever: gerar o documento inicial, melhorar o texto de uma página, sugerir tags e
          importar um documento. Ela só funciona com a <strong>sua própria chave</strong> de um provedor que você escolhe
          (Groq, OpenAI ou Anthropic).
        </p>
        <p>
          Quando você usa um desses recursos, o texto necessário para o pedido — o trecho que você quer melhorar, a
          descrição do jogo, partes do projeto que dão contexto, o documento importado — passa pelo nosso servidor e
          segue para esse provedor, junto com a sua chave. Não guardamos esse texto nem a resposta. O que o provedor faz
          com eles é regido pela política dele, no contrato que você tem com ele.
        </p>
        <p>
          A sua chave fica guardada no seu perfil (que só você lê) e no seu navegador, para você não ter que colar de
          novo. Você pode apagá-la a qualquer momento nas configurações de IA. Uma dica: crie uma chave só para o GDD,
          com limite de gasto.
        </p>
      </LegalSection>

      <LegalSection title="Agentes de IA e chaves de acesso">
        <p>
          Você pode conectar um assistente (o Claude, por exemplo) ao seu GDD, por um conector ou por uma chave de
          acesso. A partir daí, esse assistente lê e escreve nos seus projetos em seu nome, com as mesmas permissões que
          você tem. O que ele faz com o que leu segue a política de quem fornece o assistente.
        </p>
        <p>
          As conexões têm validade: o acesso dura 7 dias e se renova sozinho por até 90 dias de uso. Você pode
          desconectar um assistente ou revogar uma chave a qualquer momento, e ele perde o acesso na hora.
        </p>
      </LegalSection>

      <LegalSection title="Compartilhar e trabalhar em equipe">
        <ul>
          <li>
            <strong>Membros:</strong> quem participa do mesmo projeto vê o nome e o e-mail das outras pessoas do
            projeto, e vê o nome de quem editou cada página no histórico.
          </li>
          <li>
            <strong>Link público:</strong> se você ligar o compartilhamento público de um projeto, qualquer pessoa com
            o link consegue ler o conteúdo dele, sem login. O link não mostra seu nome nem seu e-mail. Desligar o
            compartilhamento corta o acesso.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>Usamos poucos cookies, e todos são necessários para o site funcionar:</p>
        <ul>
          <li>
            <strong>Sessão de login</strong> — mantém você conectado. Sem ele, não dá para entrar na conta.
          </li>
          <li>
            <strong>Idioma (gdd_locale)</strong> — lembra o idioma que você escolheu, por até um ano.
          </li>
        </ul>
        <p>
          Não usamos cookies de anúncio, de estatística ou de rastreio. Quando você abre a janela do Google Drive ou
          entra com o Google, as páginas do Google podem usar os cookies delas, conforme a política do Google.
        </p>
      </LegalSection>

      <LegalSection title="O que nós não fazemos">
        <ul>
          <li>Não vendemos nem alugamos seus dados para ninguém.</li>
          <li>Não mostramos anúncios e não montamos perfil de você para publicidade.</li>
          <li>Não usamos ferramentas de estatística, de rastreio ou de gravação de tela.</li>
          <li>Não usamos o conteúdo dos seus projetos para treinar IA.</li>
          <li>Não lemos seus projetos, salvo se você pedir ajuda com um problema ou se a lei exigir.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Com quem os dados passam">
        <p>Para o GDD funcionar, contamos com alguns serviços, que tratam os dados só para isso:</p>
        <ul>
          <li><strong>Supabase</strong> — banco de dados e login (servidores no leste dos EUA).</li>
          <li><strong>Vercel</strong> — hospedagem do site (servidores no leste dos EUA).</li>
          <li><strong>Google</strong> — login com Google e biblioteca de imagens do Drive, quando você usa.</li>
          <li><strong>O provedor de IA que você escolher</strong> — só quando você usa um recurso de IA.</li>
        </ul>
        <p>
          Como esses servidores ficam nos Estados Unidos, seus dados são transferidos para fora do Brasil (e, para
          quem está na Europa, para fora do Espaço Econômico Europeu). Fazemos isso para executar o serviço que você
          pediu e contamos com provedores que adotam cláusulas contratuais e medidas de segurança reconhecidas para esse
          tipo de transferência.
        </p>
        <p>
          Também podemos compartilhar dados se uma autoridade exigir, nos limites da lei.
        </p>
      </LegalSection>

      <LegalSection title="Por que podemos tratar esses dados">
        <ul>
          <li>
            <strong>Para prestar o serviço que você pediu</strong> (execução de contrato): conta, sincronização,
            colaboração, histórico.
          </li>
          <li>
            <strong>Com o seu consentimento</strong>: acesso ao Google Drive e envio de texto ao provedor de IA. Você
            pode retirar a qualquer momento.
          </li>
          <li>
            <strong>Por interesse legítimo</strong>: segurança, prevenção de abuso e limites de uso que mantêm o
            serviço de pé para todos.
          </li>
          <li>
            <strong>Por obrigação legal</strong>, quando a lei exigir guardar ou entregar algum dado.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Por quanto tempo guardamos">
        <ul>
          <li>Conta, perfil e projetos: enquanto a conta existir.</li>
          <li>Histórico de uma página: enquanto a página existir. Apagar a página apaga o histórico dela.</li>
          <li>Registro de atividade: até 90 dias, e no máximo os 200 eventos mais recentes de cada projeto.</li>
          <li>Conexões de assistentes: o acesso vence em 7 dias e a renovação em 90 dias sem uso.</li>
          <li>
            Ao apagar a conta, apagamos com ela o perfil, os projetos dos quais você é dono, as chaves e as conexões.
            Em projetos de outras pessoas, seu nome pode continuar no histórico das páginas que você editou, porque ele
            faz parte do registro daquele documento.
          </li>
          <li>
            Os serviços que usamos mantêm registros técnicos (como endereço IP e horário de acesso) e cópias de
            segurança por um período curto, conforme as regras de cada um.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Como protegemos">
        <ul>
          <li>Toda a comunicação com o site é cifrada (HTTPS).</li>
          <li>
            Cada projeto na nuvem só pode ser lido pelo dono e pelos membros convidados — a regra é aplicada no próprio
            banco de dados, linha por linha.
          </li>
          <li>Chaves de acesso e tokens de conexão são guardados só como impressão digital, nunca por inteiro.</li>
          <li>Sua senha é tratada pelo serviço de login, cifrada; nós não temos acesso a ela.</li>
          <li>O acesso ao seu Google Drive nunca chega aos nossos servidores.</li>
        </ul>
        <p>
          Nenhum sistema é perfeito. Se acontecer um incidente que possa trazer risco a você, avisaremos você e a
          autoridade de proteção de dados, como a lei manda.
        </p>
      </LegalSection>

      <LegalSection title="Seus direitos">
        <p>Pela LGPD (e pelo GDPR, se você estiver na Europa), você pode a qualquer momento:</p>
        <ul>
          <li>saber se tratamos dados seus e pedir acesso a eles;</li>
          <li>corrigir dados incompletos ou errados — é só nos escrever;</li>
          <li>
            <strong>levar seus dados</strong> para outro lugar — veja <Link href={legalHref("exportar")}>Exportar os dados</Link>;
          </li>
          <li>
            <strong>apagar a conta e os dados</strong> — veja{" "}
            <Link href={legalHref("esquecimento")}>Direito ao esquecimento</Link>;
          </li>
          <li>retirar um consentimento (Drive, IA) e saber o que muda quando você retira;</li>
          <li>saber com quem compartilhamos seus dados;</li>
          <li>se opor a um tratamento ou pedir que ele seja limitado.</li>
        </ul>
        <p>
          Para qualquer pedido, escreva para <Mail />. Respondemos em até 15 dias. Se não ficar satisfeito, você pode
          reclamar à ANPD (Autoridade Nacional de Proteção de Dados) ou à autoridade de proteção de dados do seu país.
        </p>
      </LegalSection>

      <LegalSection title="Crianças">
        <p>
          O GDD não é feito para menores de 13 anos, e não coletamos dados deles de propósito. Quem tem menos de 18
          anos deve usar com a autorização de um responsável. Se você acha que uma criança criou uma conta, escreva para{" "}
          <Mail /> e apagamos.
        </p>
      </LegalSection>

      <LegalSection title="Mudanças nesta política">
        <p>
          Se mudarmos o que fazemos com os seus dados, esta página muda junto e a data lá em cima é atualizada. Se a
          mudança for importante, avisamos dentro do app antes de ela valer. Veja também os{" "}
          <Link href={legalHref("termos")}>Termos de uso</Link> e as{" "}
          <Link href={legalHref("garantias")}>Garantias e continuidade</Link>.
        </p>
      </LegalSection>

      <LegalSection title="Fale com a gente">
        <p>
          {LEGAL_OPERATOR} — <Mail />
        </p>
      </LegalSection>
    </>
  );
}

/* --------------------------------------------------------------------- en */

function BodyEn() {
  return (
    <>
      <LegalCallout>
        <strong>In short:</strong> your projects live in your browser first. They only go to the cloud when you sync,
        and there only you and the people you invite can see them. We keep the minimum your account needs, we sell
        nothing, show no ads and use no tracking tools. You can ask for a copy of everything, or delete everything,
        whenever you want.
      </LegalCallout>

      <LegalSection title="Who looks after your data">
        <p>
          GDD Manager is run by <a href={LEGAL_OPERATOR_URL} target="_blank" rel="noopener noreferrer"><strong>{LEGAL_OPERATOR}</strong></a>, which is responsible (the &quot;controller&quot;, in
          LGPD and GDPR terms) for the data handled here. For anything privacy-related — a question, a request or a
          complaint — there is one channel: <Mail />. The same address reaches our data protection officer.
        </p>
      </LegalSection>

      <LegalSection title="What stays only in your browser">
        <p>
          GDD is built to work offline. So everything you write is saved first in your browser&apos;s local storage, on
          this device: projects and pages, sync settings, theme (light or dark), language and a few screen preferences.
        </p>
        <p>
          None of that leaves your computer on its own. If you clear your browser data, that local copy is gone — so
          sync or export what matters.
        </p>
      </LegalSection>

      <LegalSection title="What we keep in the cloud">
        <p>
          Cloud sync is manual by default: a project only reaches our servers when you click sync, or when you turn on
          automatic sync yourself in the settings. The table below lists everything that may be stored on our side.
        </p>
        <DataTable
          head={["Data", "What for", "Where"]}
          rows={[
            [
              "Email, display name and password",
              "To create your account, sign you in and show who you are. The password is stored encrypted by the sign-in service; we never see it.",
              "Supabase (USA)",
            ],
            [
              "Name, email and photo from Google",
              "When you sign in with Google, that is all it returns. Used to create the account and fill in your name.",
              "Supabase (USA)",
            ],
            [
              "Synced projects",
              "Title, game vision, pages and their text, tables, flowcharts, cover, progress, image links and the project's AI instructions. Used to open it on another device and to work as a team.",
              "Supabase (USA)",
            ],
            [
              "Page history",
              "Each saved version of a page's title and text, with the name of whoever edited it. Powers \"What changed\" and lets you restore.",
              "Supabase (USA)",
            ],
            [
              "Activity log",
              "Page created, deleted or renamed, with the name of who did it. Shows the team what happened.",
              "Supabase (USA)",
            ],
            [
              "Project members",
              "Who was invited, with which role (editor or viewer) and by whom.",
              "Supabase (USA)",
            ],
            [
              "Sync usage",
              "How many sync credits you used each hour, to apply plan limits.",
              "Supabase (USA)",
            ],
            [
              "AI settings",
              "The provider you chose, the model and the key you pasted. Lets AI features work on any device.",
              "Your Supabase profile (USA) and your browser",
            ],
            [
              "Access keys and agent connections",
              "Name, start of the key and date last used. The full key and connection tokens are never stored — only a fingerprint that cannot be turned back into them.",
              "Supabase (USA)",
            ],
            [
              "Deleted projects",
              "Only the ID and date, so an old copy on another device cannot bring the project back.",
              "Supabase (USA)",
            ],
          ]}
        />
        <p>
          We don&apos;t store image files: an image in a page is always a link to wherever it already lives (your Google
          Drive, for example).
        </p>
      </LegalSection>

      <LegalSection title="Google sign-in and your Google Drive folder">
        <p>
          <strong>Sign in with Google</strong> only asks for the basics: your name, email and profile photo. Signing in
          gives us no access to your Google password or to anything else in your account.
        </p>
        <p>
          <strong>The image library</strong> is separate and optional. When you pick an image or a folder from Drive,
          Google asks for <em>read-only</em> permission on your files. With it, GDD does the following, from your own
          browser:
        </p>
        <ul>
          <li>opens Google&apos;s file picker, so you can point to an image or a folder;</li>
          <li>reads the list of images in the chosen folder and its subfolders (name, ID and path of each).</li>
        </ul>
        <p>
          That list is saved in the project, so the library shows up without asking permission again. The access Google
          grants stays only in your browser&apos;s memory while the tab is open: it is not sent to our servers and not
          stored. GDD never changes, deletes or uploads files in your Drive, and reads nothing outside the folder you
          chose.
        </p>
        <p>
          GDD&apos;s use of information received from Google APIs adheres to the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. Put simply: that data is used only to show your images in GDD; it is
          not sold, not used for ads, not used to train AI, and no one on our team reads it unless you ask for help, for
          security, or when the law requires.
        </p>
        <p>
          You can remove that permission at any time at{" "}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
            myaccount.google.com/permissions
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="AI features">
        <p>
          GDD&apos;s AI helps you write: generating the first document, improving a page&apos;s text, suggesting tags and
          importing a document. It only works with <strong>your own key</strong> from a provider you choose (Groq,
          OpenAI or Anthropic).
        </p>
        <p>
          When you use one of these features, the text the request needs — the passage you want improved, your game
          description, parts of the project for context, the imported document — goes through our server to that
          provider, together with your key. We don&apos;t keep that text or the answer. What the provider does with them is
          governed by its own policy, under your agreement with it.
        </p>
        <p>
          Your key is stored in your profile (which only you can read) and in your browser, so you don&apos;t have to paste
          it again. You can delete it any time in the AI settings. Tip: create a key just for GDD, with a spending
          limit.
        </p>
      </LegalSection>

      <LegalSection title="AI agents and access keys">
        <p>
          You can connect an assistant (Claude, for example) to your GDD, through a connector or an access key. From
          then on, that assistant reads and writes your projects on your behalf, with the same permissions you have.
          What it does with what it reads follows the policy of whoever provides the assistant.
        </p>
        <p>
          Connections expire: access lasts 7 days and renews itself for up to 90 days of use. You can disconnect an
          assistant or revoke a key at any time, and it loses access right away.
        </p>
      </LegalSection>

      <LegalSection title="Sharing and teamwork">
        <ul>
          <li>
            <strong>Members:</strong> people in the same project see each other&apos;s name and email, and see who edited
            each page in its history.
          </li>
          <li>
            <strong>Public link:</strong> if you turn on public sharing for a project, anyone with the link can read
            its content without signing in. The link doesn&apos;t show your name or email. Turning sharing off cuts access.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>We use few cookies, all of them needed for the site to work:</p>
        <ul>
          <li>
            <strong>Sign-in session</strong> — keeps you signed in. Without it you can&apos;t use your account.
          </li>
          <li>
            <strong>Language (gdd_locale)</strong> — remembers the language you chose, for up to a year.
          </li>
        </ul>
        <p>
          We use no advertising, analytics or tracking cookies. When you open the Google Drive picker or sign in with
          Google, Google&apos;s pages may use their own cookies, under Google&apos;s policy.
        </p>
      </LegalSection>

      <LegalSection title="What we don't do">
        <ul>
          <li>We don&apos;t sell or rent your data to anyone.</li>
          <li>We don&apos;t show ads or build an advertising profile of you.</li>
          <li>We don&apos;t use analytics, tracking or session-recording tools.</li>
          <li>We don&apos;t use your projects&apos; content to train AI.</li>
          <li>We don&apos;t read your projects, unless you ask for help with a problem or the law requires it.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Who the data passes through">
        <p>To run GDD we rely on a few services, which handle the data only for that purpose:</p>
        <ul>
          <li><strong>Supabase</strong> — database and sign-in (servers in the eastern USA).</li>
          <li><strong>Vercel</strong> — website hosting (servers in the eastern USA).</li>
          <li><strong>Google</strong> — Google sign-in and the Drive image library, when you use them.</li>
          <li><strong>The AI provider you choose</strong> — only when you use an AI feature.</li>
        </ul>
        <p>
          Because these servers are in the United States, your data is transferred outside Brazil (and, if you are in
          Europe, outside the European Economic Area). We do this to provide the service you asked for, and we rely on
          providers that use standard contractual clauses and recognized security measures for this kind of transfer.
        </p>
        <p>We may also share data if an authority requires it, within the limits of the law.</p>
      </LegalSection>

      <LegalSection title="Why we can handle this data">
        <ul>
          <li>
            <strong>To provide the service you asked for</strong> (performance of a contract): account, sync,
            collaboration, history.
          </li>
          <li>
            <strong>With your consent</strong>: Google Drive access and sending text to the AI provider. You can
            withdraw it at any time.
          </li>
          <li>
            <strong>Legitimate interest</strong>: security, abuse prevention and usage limits that keep the service up
            for everyone.
          </li>
          <li>
            <strong>Legal obligation</strong>, when the law requires us to keep or hand over some data.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <ul>
          <li>Account, profile and projects: for as long as the account exists.</li>
          <li>A page&apos;s history: for as long as the page exists. Deleting the page deletes its history.</li>
          <li>Activity log: up to 90 days, and at most the 200 most recent events per project.</li>
          <li>Assistant connections: access expires in 7 days, renewal after 90 days without use.</li>
          <li>
            When you delete your account, we delete with it your profile, the projects you own, your keys and your
            connections. In other people&apos;s projects, your name may remain in the history of pages you edited, because
            it is part of that document&apos;s record.
          </li>
          <li>
            The services we use keep technical logs (such as IP address and access time) and backups for a short period,
            under each one&apos;s rules.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="How we protect it">
        <ul>
          <li>All communication with the site is encrypted (HTTPS).</li>
          <li>
            Each cloud project can only be read by its owner and invited members — the rule is enforced in the database
            itself, row by row.
          </li>
          <li>Access keys and connection tokens are stored only as fingerprints, never in full.</li>
          <li>Your password is handled, encrypted, by the sign-in service; we have no access to it.</li>
          <li>Access to your Google Drive never reaches our servers.</li>
        </ul>
        <p>
          No system is perfect. If an incident could put you at risk, we will tell you and the data protection
          authority, as the law requires.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>Under the LGPD (and the GDPR, if you are in Europe), you can at any time:</p>
        <ul>
          <li>find out whether we handle your data and get access to it;</li>
          <li>correct incomplete or wrong data — just write to us;</li>
          <li>
            <strong>take your data elsewhere</strong> — see <Link href={legalHref("exportar")}>Export your data</Link>;
          </li>
          <li>
            <strong>delete your account and data</strong> — see{" "}
            <Link href={legalHref("esquecimento")}>Right to be forgotten</Link>;
          </li>
          <li>withdraw a consent (Drive, AI) and know what changes when you do;</li>
          <li>know who we share your data with;</li>
          <li>object to a processing or ask for it to be restricted.</li>
        </ul>
        <p>
          For any request, write to <Mail />. We reply within 15 days. If you are not satisfied, you can complain to
          Brazil&apos;s ANPD (National Data Protection Authority) or to the data protection authority in your country.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          GDD is not meant for children under 13, and we don&apos;t knowingly collect their data. Anyone under 18 should
          use it with a parent or guardian&apos;s permission. If you think a child has created an account, write to{" "}
          <Mail /> and we will delete it.
        </p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>
          If we change what we do with your data, this page changes too and the date at the top is updated. If the
          change is significant, we will tell you inside the app before it takes effect. See also the{" "}
          <Link href={legalHref("termos")}>Terms of use</Link> and{" "}
          <Link href={legalHref("garantias")}>Guarantees and continuity</Link>.
        </p>
      </LegalSection>

      <LegalSection title="Get in touch">
        <p>
          {LEGAL_OPERATOR} — <Mail />
        </p>
      </LegalSection>
    </>
  );
}

/* --------------------------------------------------------------------- es */

function BodyEs() {
  return (
    <>
      <LegalCallout>
        <strong>En resumen:</strong> tus proyectos viven primero en tu navegador. Solo van a la nube cuando
        sincronizas, y allí solo los ven tú y las personas que invites. Guardamos lo mínimo para que tu cuenta funcione,
        no vendemos nada, no mostramos anuncios y no usamos herramientas de rastreo. Puedes pedir una copia de todo o
        borrarlo todo cuando quieras.
      </LegalCallout>

      <LegalSection title="Quién cuida tus datos">
        <p>
          GDD Manager lo mantiene <a href={LEGAL_OPERATOR_URL} target="_blank" rel="noopener noreferrer"><strong>{LEGAL_OPERATOR}</strong></a>, responsable (el &quot;controlador&quot;, en términos
          de la LGPD y del RGPD) de los datos que se tratan aquí. Para cualquier tema de privacidad — una duda, una
          solicitud o un reclamo — hay un solo canal: <Mail />. Esa misma dirección es el contacto del encargado de
          protección de datos.
        </p>
      </LegalSection>

      <LegalSection title="Lo que queda solo en tu navegador">
        <p>
          GDD está hecho para funcionar sin internet. Por eso, todo lo que escribes se guarda primero en el
          almacenamiento local de tu navegador, en este dispositivo: los proyectos y las páginas, la configuración de
          sincronización, el tema (claro u oscuro), el idioma y algunas preferencias de pantalla.
        </p>
        <p>
          Nada de eso sale de tu computadora por sí solo. Si borras los datos del navegador, esa copia local
          desaparece — por eso conviene sincronizar o exportar lo importante.
        </p>
      </LegalSection>

      <LegalSection title="Lo que guardamos en la nube">
        <p>
          La sincronización con la nube es manual por defecto: un proyecto solo llega a nuestros servidores cuando haces
          clic en sincronizar, o cuando tú mismo activas la sincronización automática en la configuración. La tabla
          muestra todo lo que puede quedar guardado de nuestro lado.
        </p>
        <DataTable
          head={["Dato", "Para qué", "Dónde"]}
          rows={[
            [
              "Correo, nombre visible y contraseña",
              "Crear la cuenta, iniciar sesión y mostrar quién eres. El servicio de inicio de sesión guarda la contraseña cifrada; nosotros nunca la vemos.",
              "Supabase (EE. UU.)",
            ],
            [
              "Nombre, correo y foto de Google",
              "Cuando entras con Google, es lo único que nos devuelve. Sirve para crear la cuenta y completar tu nombre.",
              "Supabase (EE. UU.)",
            ],
            [
              "Proyectos sincronizados",
              "Título, visión del juego, páginas y sus textos, tablas, diagramas de flujo, portada, avance, enlaces de imagen y las instrucciones para IA del proyecto. Sirve para abrirlo en otro dispositivo y trabajar en equipo.",
              "Supabase (EE. UU.)",
            ],
            [
              "Historial de páginas",
              "Cada versión guardada del título y del texto de una página, con el nombre de quien la editó. Alimenta \"Qué cambió\" y permite restaurar.",
              "Supabase (EE. UU.)",
            ],
            [
              "Registro de actividad",
              "Página creada, borrada o renombrada, con el nombre de quien lo hizo. Muestra al equipo lo que pasó.",
              "Supabase (EE. UU.)",
            ],
            [
              "Miembros del proyecto",
              "Quién fue invitado, con qué rol (editor o lector) y por quién.",
              "Supabase (EE. UU.)",
            ],
            [
              "Uso de la sincronización",
              "Cuántos créditos de sincronización usaste en cada hora, para aplicar los límites del plan.",
              "Supabase (EE. UU.)",
            ],
            [
              "Configuración de IA",
              "El proveedor elegido, el modelo y la clave que pegaste. Permite que la IA funcione en cualquier dispositivo.",
              "Tu perfil en Supabase (EE. UU.) y tu navegador",
            ],
            [
              "Claves de acceso y conexiones de agentes",
              "Nombre, inicio de la clave y fecha del último uso. La clave completa y los tokens de conexión nunca se guardan — solo una huella que no permite reconstruirlos.",
              "Supabase (EE. UU.)",
            ],
            [
              "Proyectos borrados",
              "Solo el identificador y la fecha, para que una copia vieja en otro dispositivo no traiga el proyecto de vuelta.",
              "Supabase (EE. UU.)",
            ],
          ]}
        />
        <p>
          No guardamos archivos de imagen: una imagen dentro de una página es siempre un enlace a donde ya está (tu
          Google Drive, por ejemplo).
        </p>
      </LegalSection>

      <LegalSection title="Inicio de sesión con Google y tu carpeta de Google Drive">
        <p>
          <strong>Entrar con Google</strong> pide solo lo básico: tu nombre, tu correo y tu foto de perfil. Iniciar
          sesión no nos da acceso a tu contraseña de Google ni a nada más de tu cuenta.
        </p>
        <p>
          <strong>La biblioteca de imágenes</strong> es aparte y opcional. Cuando eliges una imagen o una carpeta de
          Drive, Google pide un permiso de <em>solo lectura</em> sobre tus archivos. Con él, GDD hace lo siguiente desde
          tu propio navegador:
        </p>
        <ul>
          <li>abre el selector de archivos de Google, para que señales una imagen o una carpeta;</li>
          <li>lee la lista de imágenes de la carpeta elegida y de sus subcarpetas (nombre, identificador y ruta de cada una).</li>
        </ul>
        <p>
          Esa lista se guarda en el proyecto, para mostrar la biblioteca sin pedir permiso de nuevo. El acceso que
          concede Google queda solo en la memoria del navegador mientras la pestaña está abierta: no se envía a nuestros
          servidores ni se guarda. GDD nunca modifica, borra ni sube archivos a tu Drive, y no lee nada fuera de la
          carpeta que elegiste.
        </p>
        <p>
          El uso que GDD hace de la información recibida de las API de Google cumple la{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
            Política de Datos del Usuario de los Servicios de API de Google
          </a>
          , incluidos los requisitos de Uso Limitado. En palabras simples: esos datos sirven solo para mostrar tus
          imágenes en GDD; no se venden, no se usan para anuncios ni para entrenar IA, y nadie del equipo los lee salvo
          que pidas ayuda, por seguridad o porque la ley lo exija.
        </p>
        <p>
          Puedes quitar ese permiso cuando quieras en{" "}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
            myaccount.google.com/permissions
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Funciones de IA">
        <p>
          La IA de GDD ayuda a escribir: generar el documento inicial, mejorar el texto de una página, sugerir etiquetas
          e importar un documento. Solo funciona con <strong>tu propia clave</strong> de un proveedor que eliges (Groq,
          OpenAI o Anthropic).
        </p>
        <p>
          Cuando usas una de estas funciones, el texto que el pedido necesita — el fragmento que quieres mejorar, la
          descripción del juego, partes del proyecto que dan contexto, el documento importado — pasa por nuestro
          servidor y va a ese proveedor, junto con tu clave. No guardamos ese texto ni la respuesta. Lo que el proveedor
          haga con ellos se rige por su propia política, según tu contrato con él.
        </p>
        <p>
          Tu clave se guarda en tu perfil (que solo tú puedes leer) y en tu navegador, para que no tengas que pegarla
          otra vez. Puedes borrarla cuando quieras en la configuración de IA. Un consejo: crea una clave solo para GDD,
          con límite de gasto.
        </p>
      </LegalSection>

      <LegalSection title="Agentes de IA y claves de acceso">
        <p>
          Puedes conectar un asistente (Claude, por ejemplo) a tu GDD, mediante un conector o una clave de acceso. A
          partir de ahí, ese asistente lee y escribe en tus proyectos en tu nombre, con los mismos permisos que tú. Lo
          que haga con lo que leyó sigue la política de quien ofrece el asistente.
        </p>
        <p>
          Las conexiones caducan: el acceso dura 7 días y se renueva solo durante hasta 90 días de uso. Puedes
          desconectar un asistente o revocar una clave cuando quieras, y pierde el acceso al instante.
        </p>
      </LegalSection>

      <LegalSection title="Compartir y trabajar en equipo">
        <ul>
          <li>
            <strong>Miembros:</strong> quienes participan en el mismo proyecto ven el nombre y el correo de las demás
            personas del proyecto, y ven quién editó cada página en el historial.
          </li>
          <li>
            <strong>Enlace público:</strong> si activas el uso compartido público de un proyecto, cualquiera con el
            enlace puede leer su contenido sin iniciar sesión. El enlace no muestra tu nombre ni tu correo. Desactivarlo
            corta el acceso.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>Usamos pocas cookies, y todas son necesarias para que el sitio funcione:</p>
        <ul>
          <li>
            <strong>Sesión de inicio</strong> — te mantiene conectado. Sin ella no puedes entrar en tu cuenta.
          </li>
          <li>
            <strong>Idioma (gdd_locale)</strong> — recuerda el idioma que elegiste, hasta por un año.
          </li>
        </ul>
        <p>
          No usamos cookies de publicidad, estadística ni rastreo. Cuando abres el selector de Google Drive o entras con
          Google, las páginas de Google pueden usar sus propias cookies, según la política de Google.
        </p>
      </LegalSection>

      <LegalSection title="Lo que no hacemos">
        <ul>
          <li>No vendemos ni alquilamos tus datos a nadie.</li>
          <li>No mostramos anuncios ni armamos un perfil tuyo para publicidad.</li>
          <li>No usamos herramientas de estadística, rastreo ni grabación de pantalla.</li>
          <li>No usamos el contenido de tus proyectos para entrenar IA.</li>
          <li>No leemos tus proyectos, salvo que pidas ayuda con un problema o la ley lo exija.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Por dónde pasan los datos">
        <p>Para que GDD funcione usamos algunos servicios, que tratan los datos solo con ese fin:</p>
        <ul>
          <li><strong>Supabase</strong> — base de datos e inicio de sesión (servidores en el este de EE. UU.).</li>
          <li><strong>Vercel</strong> — alojamiento del sitio (servidores en el este de EE. UU.).</li>
          <li><strong>Google</strong> — inicio de sesión con Google y biblioteca de imágenes de Drive, cuando los usas.</li>
          <li><strong>El proveedor de IA que elijas</strong> — solo cuando usas una función de IA.</li>
        </ul>
        <p>
          Como esos servidores están en Estados Unidos, tus datos se transfieren fuera de Brasil (y, si estás en Europa,
          fuera del Espacio Económico Europeo). Lo hacemos para prestar el servicio que pediste y contamos con
          proveedores que adoptan cláusulas contractuales tipo y medidas de seguridad reconocidas para este tipo de
          transferencia.
        </p>
        <p>También podemos compartir datos si una autoridad lo exige, dentro de los límites de la ley.</p>
      </LegalSection>

      <LegalSection title="Por qué podemos tratar estos datos">
        <ul>
          <li>
            <strong>Para prestar el servicio que pediste</strong> (ejecución de un contrato): cuenta, sincronización,
            colaboración, historial.
          </li>
          <li>
            <strong>Con tu consentimiento</strong>: acceso a Google Drive y envío de texto al proveedor de IA. Puedes
            retirarlo cuando quieras.
          </li>
          <li>
            <strong>Por interés legítimo</strong>: seguridad, prevención de abusos y límites de uso que mantienen el
            servicio en pie para todos.
          </li>
          <li>
            <strong>Por obligación legal</strong>, cuando la ley exija guardar o entregar algún dato.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Cuánto tiempo los guardamos">
        <ul>
          <li>Cuenta, perfil y proyectos: mientras exista la cuenta.</li>
          <li>Historial de una página: mientras exista la página. Borrar la página borra su historial.</li>
          <li>Registro de actividad: hasta 90 días, y como máximo los 200 eventos más recientes de cada proyecto.</li>
          <li>Conexiones de asistentes: el acceso vence en 7 días y la renovación tras 90 días sin uso.</li>
          <li>
            Al borrar la cuenta, borramos con ella el perfil, los proyectos de los que eres dueño, las claves y las
            conexiones. En proyectos de otras personas, tu nombre puede seguir en el historial de las páginas que
            editaste, porque forma parte del registro de ese documento.
          </li>
          <li>
            Los servicios que usamos guardan registros técnicos (como dirección IP y hora de acceso) y copias de
            seguridad por un período corto, según las reglas de cada uno.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Cómo los protegemos">
        <ul>
          <li>Toda la comunicación con el sitio va cifrada (HTTPS).</li>
          <li>
            Cada proyecto en la nube solo lo pueden leer su dueño y los miembros invitados — la regla se aplica en la
            propia base de datos, fila por fila.
          </li>
          <li>Las claves de acceso y los tokens de conexión se guardan solo como huella, nunca completos.</li>
          <li>Tu contraseña la gestiona, cifrada, el servicio de inicio de sesión; no tenemos acceso a ella.</li>
          <li>El acceso a tu Google Drive nunca llega a nuestros servidores.</li>
        </ul>
        <p>
          Ningún sistema es perfecto. Si ocurre un incidente que pueda ponerte en riesgo, te avisaremos a ti y a la
          autoridad de protección de datos, como exige la ley.
        </p>
      </LegalSection>

      <LegalSection title="Tus derechos">
        <p>Según la LGPD (y el RGPD, si estás en Europa), puedes en cualquier momento:</p>
        <ul>
          <li>saber si tratamos datos tuyos y acceder a ellos;</li>
          <li>corregir datos incompletos o erróneos — basta con escribirnos;</li>
          <li>
            <strong>llevarte tus datos</strong> a otro lugar — mira <Link href={legalHref("exportar")}>Exportar tus datos</Link>;
          </li>
          <li>
            <strong>borrar tu cuenta y tus datos</strong> — mira{" "}
            <Link href={legalHref("esquecimento")}>Derecho al olvido</Link>;
          </li>
          <li>retirar un consentimiento (Drive, IA) y saber qué cambia cuando lo retiras;</li>
          <li>saber con quién compartimos tus datos;</li>
          <li>oponerte a un tratamiento o pedir que se limite.</li>
        </ul>
        <p>
          Para cualquier solicitud, escribe a <Mail />. Respondemos en un plazo de 15 días. Si no quedas conforme,
          puedes reclamar ante la ANPD (Autoridad Nacional de Protección de Datos de Brasil) o ante la autoridad de
          protección de datos de tu país.
        </p>
      </LegalSection>

      <LegalSection title="Niños">
        <p>
          GDD no está hecho para menores de 13 años, y no recogemos sus datos a sabiendas. Quien tenga menos de 18 años
          debe usarlo con permiso de un padre, madre o tutor. Si crees que un niño creó una cuenta, escribe a <Mail /> y
          la borramos.
        </p>
      </LegalSection>

      <LegalSection title="Cambios en esta política">
        <p>
          Si cambiamos lo que hacemos con tus datos, esta página cambia también y la fecha de arriba se actualiza. Si el
          cambio es importante, te avisaremos dentro de la app antes de que entre en vigor. Mira también los{" "}
          <Link href={legalHref("termos")}>Términos de uso</Link> y{" "}
          <Link href={legalHref("garantias")}>Garantías y continuidad</Link>.
        </p>
      </LegalSection>

      <LegalSection title="Contacto">
        <p>
          {LEGAL_OPERATOR} — <Mail />
        </p>
      </LegalSection>
    </>
  );
}

/** Corpo da política por idioma — escolhido com `pick(PRIVACY_BODY, locale)`. */
export const PRIVACY_BODY: Record<AppLocale, () => ReactNode> = {
  "pt-BR": BodyPt,
  en: BodyEn,
  es: BodyEs,
};
