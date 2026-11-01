import type { ReactNode } from "react";
import Link from "next/link";
import type { AppLocale } from "@/lib/i18n/config";
import { LEGAL_CONTACT_EMAIL, LEGAL_OPERATOR, LEGAL_OPERATOR_URL, legalHref } from "@/lib/legal/pages";

/**
 * Texto dos Termos de uso nos três idiomas. Mora ao lado da página (e não em
 * locales/*.json) pelo mesmo motivo das outras páginas /legal: é longo, muda
 * junto com a página e não é reaproveitado em lugar nenhum.
 *
 * Cada afirmação aqui foi conferida no código (login em store/authStore.ts,
 * IA em utils/ai + app/api/ai, papéis de membro em lib/supabase/schema.sql,
 * link público em app/s/[token]). Ao mudar o produto, mudar o texto junto —
 * e trocar LEGAL_UPDATED_AT.
 */

type TermsSection = { title: string; body: ReactNode };
type TermsContent = { summaryTitle: string; summary: ReactNode; sections: TermsSection[] };

const REPO_URL = "https://github.com/Doublehitgames/GddApp";
const GPL_URL = "https://www.gnu.org/licenses/gpl-3.0.html";

const mail = <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>;
const repo = (
  <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
    github.com/Doublehitgames/GddApp
  </a>
);
const gpl = (
  <a href={GPL_URL} target="_blank" rel="noopener noreferrer">
    GPL-3.0
  </a>
);

const ptBR: TermsContent = {
  summaryTitle: "Em resumo",
  summary: (
    <ul className="ml-5 list-disc space-y-1.5">
      <li>O que você escreve no GDD é seu. A gente só guarda, mostra e sincroniza para você.</li>
      <li>O app funciona no seu navegador; mandar para a nuvem é opcional, projeto a projeto.</li>
      <li>Há um plano gratuito, com limites por projeto que podem mudar.</li>
      <li>Quando você usa a IA, o texto vai para o provedor de IA que você escolheu, com a sua chave.</li>
      <li>Se você deixa um agente (como o Claude) mexer no seu GDD, o que ele faz em seu nome é responsabilidade sua.</li>
      <li>O serviço é oferecido do jeito que está, sem garantia de que nunca vai sair do ar — e o código é aberto.</li>
    </ul>
  ),
  sections: [
    {
      title: "1. Quem está do outro lado",
      body: (
        <>
          <p>
            O GDD Manager é mantido por <a href={LEGAL_OPERATOR_URL} target="_blank" rel="noopener noreferrer"><strong>{LEGAL_OPERATOR}</strong></a>. Ao criar uma conta ou usar o app, você concorda com estes termos. Se não
            concordar, tudo bem — só não use o serviço.
          </p>
          <p>Dúvida, pedido ou reclamação: escreva para {mail}. É uma pessoa que lê.</p>
        </>
      ),
    },
    {
      title: "2. O que é o serviço",
      body: (
        <p>
          O GDD Manager é um lugar para escrever e navegar o Game Design Document do seu jogo: uma árvore de páginas, com visão do jogo, documentação,
          biblioteca de balanceamento, mapa mental, modo documento, modo deck e exportação. O serviço pode ganhar, mudar ou perder funções com o tempo.
        </p>
      ),
    },
    {
      title: "3. Sua conta",
      body: (
        <>
          <p>
            Você entra com e-mail e senha ou com a sua conta Google. Cuide do acesso: não compartilhe a senha, e avise a gente se achar que alguém
            entrou na sua conta sem permissão. O que acontece dentro da conta é responsabilidade de quem é dono dela.
          </p>
          <p>Use dados verdadeiros no cadastro. Uma conta é de uma pessoa; para trabalhar em equipe, convide as outras pessoas para o projeto.</p>
        </>
      ),
    },
    {
      title: "4. O seu conteúdo continua seu",
      body: (
        <>
          <p>
            Tudo o que você escreve — textos, tabelas, imagens que você liga, a ideia do jogo — continua sendo seu. A gente não reivindica nenhum
            direito sobre o seu jogo.
          </p>
          <p>
            Para o app funcionar, você nos dá uma permissão limitada para <strong>guardar, mostrar e sincronizar</strong> esse conteúdo: exibir para
            você e para quem você convidou, copiar entre o navegador e a nuvem, fazer cópia de segurança e gerar as exportações que você pedir. Essa
            permissão serve só para isso e termina quando você apaga o conteúdo ou a conta. A gente não vende o seu conteúdo nem o usa para
            divulgação.
          </p>
          <p>Você garante que tem o direito de colocar no GDD o que coloca lá (por exemplo, imagens de terceiros).</p>
        </>
      ),
    },
    {
      title: "5. Uso aceitável",
      body: (
        <>
          <p>Use o GDD para documentar jogos e projetos criativos. Não vale:</p>
          <ul>
            <li>publicar ou compartilhar conteúdo ilegal, que viole direitos de outras pessoas ou que sirva para assediar alguém;</li>
            <li>tentar acessar projetos ou contas que não são seus, ou burlar os limites do plano;</li>
            <li>sobrecarregar o serviço de propósito (por exemplo, com automações que disparam pedidos sem parar);</li>
            <li>usar o serviço para espalhar vírus, spam ou golpes.</li>
          </ul>
          <p>Se alguém fizer isso, podemos remover o conteúdo, limitar ou suspender a conta.</p>
        </>
      ),
    },
    {
      title: "6. Planos e limites",
      body: (
        <>
          <p>
            Hoje o GDD tem um plano gratuito. Ele tem limites — de projetos, de páginas por projeto e de quanto se sincroniza com a nuvem por hora.
            Os números atuais aparecem dentro do app e podem mudar com o tempo, para cima ou para baixo, conforme o custo de manter o serviço.
          </p>
          <p>
            Num projeto compartilhado, valem os limites de quem é dono do projeto. Se um limite for atingido, o app continua funcionando no seu
            navegador; só a nuvem espera.
          </p>
          <p>Se um dia existir um plano pago, as condições dele serão apresentadas antes de você contratar qualquer coisa.</p>
        </>
      ),
    },
    {
      title: "7. Ajudas de IA",
      body: (
        <>
          <p>
            O GDD tem ajudas de IA para escrever: gerar o GDD inicial a partir de uma ideia, importar um documento que você já tem, melhorar o texto
            de uma página, sugerir onde uma página nova se encaixa e sugerir tags. Elas são opcionais e só funcionam depois que você configura um
            provedor de IA (Groq, OpenAI ou Anthropic) com a <strong>sua própria chave</strong>.
          </p>
          <p>
            Quando você usa uma dessas ajudas, o texto envolvido (a sua ideia, a página ou trechos do projeto) passa pelo nosso servidor e é enviado a
            esse provedor. A partir daí valem também os termos e a política de privacidade dele, e o custo do uso fica na sua conta com ele.
          </p>
          <p>
            A IA erra. O que ela sugere é rascunho: revise antes de aceitar. A gente não responde pelo que o texto gerado diz nem garante que ele seja
            original.
          </p>
        </>
      ),
    },
    {
      title: "8. Agentes, conector do Claude e chaves de API",
      body: (
        <>
          <p>
            Você pode ligar o seu GDD a um agente de IA — pelo conector do Claude ou pelo servidor MCP local com uma chave de API — e também usar
            essas chaves em scripts próprios. O agente passa a ler e escrever no GDD <strong>em seu nome</strong>, com as mesmas permissões que você
            tem.
          </p>
          <p>
            Por isso, o que o agente fizer (criar, mudar ou apagar páginas) conta como feito por você. Guarde as chaves como guarda uma senha,
            não as publique, e revogue a chave ou desconecte o conector quando não precisar mais. Se uma chave vazar, revogue na hora em
            Configurações.
          </p>
        </>
      ),
    },
    {
      title: "9. Compartilhar e colaborar",
      body: (
        <>
          <p>
            Ao convidar alguém para um projeto, essa pessoa passa a ver o projeto inteiro — e, se for editora, também a mudar e apagar páginas.
            Convide só quem deve ter esse acesso; você pode tirar a pessoa do projeto quando quiser.
          </p>
          <p>
            Ao criar um <strong>link público</strong>, qualquer pessoa com o link vê o projeto, sem precisar de conta. Só leitura, mas aberto: trate o
            link como algo publicado. Desligue o link para fechar o acesso.
          </p>
        </>
      ),
    },
    {
      title: "10. Onde os seus dados vivem",
      body: (
        <>
          <p>
            O GDD funciona primeiro no seu navegador: os projetos ficam guardados nele, e dá para trabalhar sem internet. A sincronização com a nuvem
            é opcional e escolhida projeto a projeto.
          </p>
          <p>
            Isso tem um lado que é seu: se você limpar os dados do navegador ou trocar de computador sem ter sincronizado, o que estava só ali se
            perde. Sincronize ou exporte o que for importante — veja <Link href={legalHref("exportar")}>Exportar os dados</Link>.
          </p>
        </>
      ),
    },
    {
      title: "11. Disponibilidade",
      body: (
        <>
          <p>
            A gente se esforça para o GDD estar no ar e funcionando, mas ele é oferecido <strong>do jeito que está</strong>, sem garantia de
            disponibilidade contínua, de ausência de erros ou de que sirva para um fim específico. Pode haver manutenção, instabilidade ou
            mudança de funções.
          </p>
          <p>
            Na medida em que a lei permitir, {LEGAL_OPERATOR} não responde por perdas indiretas — como atraso no projeto ou dados que estavam só no
            navegador. O que acontece com o seu GDD se o site mudar ou sair do ar está em{" "}
            <Link href={legalHref("garantias")}>Garantias e continuidade</Link>.
          </p>
        </>
      ),
    },
    {
      title: "12. O código é aberto",
      body: (
        <p>
          O código do GDD Manager é aberto, sob a licença {gpl}, e está em {repo}. Você pode ler, rodar a sua própria cópia e modificar, seguindo as
          regras dessa licença. Estes termos valem para o serviço que nós mantemos; uma cópia rodada por outra pessoa é responsabilidade de quem a
          roda.
        </p>
      ),
    },
    {
      title: "13. Encerramento",
      body: (
        <>
          <p>
            Você pode parar de usar o GDD quando quiser e apagar a sua conta e os seus dados — o passo a passo está em{" "}
            <Link href={legalHref("esquecimento")}>Direito ao esquecimento</Link>. Antes, se quiser, leve tudo com você pela exportação.
          </p>
          <p>
            Podemos suspender ou encerrar uma conta que descumpra estes termos. Quando der, avisamos antes e explicamos o motivo.
          </p>
        </>
      ),
    },
    {
      title: "14. Mudanças nestes termos",
      body: (
        <p>
          Estes termos podem ser atualizados. A data da última revisão fica no topo desta página. Se a mudança for importante, avisamos dentro do app
          antes de ela valer. Continuar usando o GDD depois disso significa aceitar a versão nova.
        </p>
      ),
    },
    {
      title: "15. Lei aplicável",
      body: (
        <p>
          Estes termos seguem a lei brasileira, incluindo a Lei Geral de Proteção de Dados (LGPD). Como tratamos os seus dados pessoais está na{" "}
          <Link href={legalHref("privacidade")}>Política de privacidade</Link>. Antes de qualquer disputa, escreva para {mail} — a gente prefere
          resolver conversando.
        </p>
      ),
    },
  ],
};

const en: TermsContent = {
  summaryTitle: "In short",
  summary: (
    <ul className="ml-5 list-disc space-y-1.5">
      <li>What you write in GDD is yours. We only store, show and sync it for you.</li>
      <li>The app runs in your browser; sending it to the cloud is optional, project by project.</li>
      <li>There is a free plan, with per-project limits that may change.</li>
      <li>When you use the AI helpers, the text goes to the AI provider you picked, using your own key.</li>
      <li>If you let an agent (like Claude) work on your GDD, what it does on your behalf is your responsibility.</li>
      <li>The service is offered as is, with no promise it will never go down — and the code is open source.</li>
    </ul>
  ),
  sections: [
    {
      title: "1. Who is on the other side",
      body: (
        <>
          <p>
            GDD Manager is run by <a href={LEGAL_OPERATOR_URL} target="_blank" rel="noopener noreferrer"><strong>{LEGAL_OPERATOR}</strong></a>. By creating an account or using the app, you agree to these terms. If you
            don&apos;t agree, that&apos;s fine — just don&apos;t use the service.
          </p>
          <p>Questions, requests or complaints: write to {mail}. A real person reads it.</p>
        </>
      ),
    },
    {
      title: "2. What the service is",
      body: (
        <p>
          GDD Manager is a place to write and browse your game&apos;s design document: a tree of pages, with the game vision, documentation, a
          balancing library, a mind map, document mode, deck mode and export. Features may be added, changed or removed over time.
        </p>
      ),
    },
    {
      title: "3. Your account",
      body: (
        <>
          <p>
            You sign in with email and password or with your Google account. Look after that access: don&apos;t share your password, and tell us if
            you think someone got into your account without permission. What happens inside an account is its owner&apos;s responsibility.
          </p>
          <p>Use real details when signing up. One account is for one person; to work as a team, invite the others to the project.</p>
        </>
      ),
    },
    {
      title: "4. Your content stays yours",
      body: (
        <>
          <p>
            Everything you write — text, tables, images you link, the idea of the game — remains yours. We claim no rights over your game.
          </p>
          <p>
            For the app to work, you give us a limited permission to <strong>store, display and sync</strong> that content: show it to you and to
            the people you invited, copy it between your browser and the cloud, back it up and produce the exports you ask for. That permission is
            only for this and ends when you delete the content or the account. We don&apos;t sell your content or use it for promotion.
          </p>
          <p>You confirm you have the right to put in GDD whatever you put there (for example, third-party images).</p>
        </>
      ),
    },
    {
      title: "5. Acceptable use",
      body: (
        <>
          <p>Use GDD to document games and creative projects. Not allowed:</p>
          <ul>
            <li>publishing or sharing content that is illegal, infringes other people&apos;s rights or is used to harass someone;</li>
            <li>trying to access projects or accounts that aren&apos;t yours, or getting around plan limits;</li>
            <li>overloading the service on purpose (for example, with automations that fire requests nonstop);</li>
            <li>using the service to spread malware, spam or scams.</li>
          </ul>
          <p>If someone does this, we may remove the content, or limit or suspend the account.</p>
        </>
      ),
    },
    {
      title: "6. Plans and limits",
      body: (
        <>
          <p>
            Today GDD has a free plan. It has limits — on projects, on pages per project and on how much is synced to the cloud per hour. The current
            numbers are shown inside the app and may change over time, up or down, depending on what it costs to keep the service running.
          </p>
          <p>
            In a shared project, the project owner&apos;s limits apply. If a limit is reached, the app keeps working in your browser; only the cloud
            waits.
          </p>
          <p>If a paid plan ever exists, its conditions will be shown to you before you pay for anything.</p>
        </>
      ),
    },
    {
      title: "7. AI helpers",
      body: (
        <>
          <p>
            GDD has AI helpers for writing: generating a first GDD from an idea, importing a document you already have, improving a page&apos;s text,
            suggesting where a new page fits and suggesting tags. They are optional and only work after you set up an AI provider (Groq, OpenAI or
            Anthropic) with <strong>your own key</strong>.
          </p>
          <p>
            When you use one of them, the text involved (your idea, the page or parts of the project) goes through our server and is sent to that
            provider. From then on, that provider&apos;s terms and privacy policy also apply, and the cost of the usage is on your account with them.
          </p>
          <p>
            AI makes mistakes. What it suggests is a draft: review it before accepting. We are not responsible for what generated text says and
            don&apos;t guarantee it is original.
          </p>
        </>
      ),
    },
    {
      title: "8. Agents, the Claude connector and API keys",
      body: (
        <>
          <p>
            You can connect your GDD to an AI agent — through the Claude connector or the local MCP server with an API key — and also use those keys
            in your own scripts. The agent then reads and writes in GDD <strong>on your behalf</strong>, with the same permissions you have.
          </p>
          <p>
            So whatever the agent does (create, change or delete pages) counts as done by you. Keep keys the way you keep a password, don&apos;t
            publish them, and revoke the key or disconnect the connector when you no longer need it. If a key leaks, revoke it right away in
            Settings.
          </p>
        </>
      ),
    },
    {
      title: "9. Sharing and collaboration",
      body: (
        <>
          <p>
            When you invite someone to a project, that person can see the whole project — and, as an editor, also change and delete pages. Only
            invite people who should have that access; you can remove them whenever you want.
          </p>
          <p>
            When you create a <strong>public link</strong>, anyone with the link can view the project, no account needed. Read-only, but open: treat
            the link as something published. Turn the link off to close access.
          </p>
        </>
      ),
    },
    {
      title: "10. Where your data lives",
      body: (
        <>
          <p>
            GDD works first in your browser: your projects are stored there, and you can work offline. Syncing to the cloud is optional and chosen
            project by project.
          </p>
          <p>
            That has a side that is yours to handle: if you clear your browser data or switch computers without syncing, whatever was only there is
            lost. Sync or export what matters — see <Link href={legalHref("exportar")}>Export your data</Link>.
          </p>
        </>
      ),
    },
    {
      title: "11. Availability",
      body: (
        <>
          <p>
            We work hard to keep GDD up and running, but it is offered <strong>as is</strong>, with no guarantee of continuous availability, of being
            error-free or of fitting a particular purpose. There may be maintenance, instability or changes to features.
          </p>
          <p>
            To the extent the law allows, {LEGAL_OPERATOR} is not liable for indirect losses — such as project delays or data that lived only in the
            browser. What happens to your GDD if the site changes or goes down is described in{" "}
            <Link href={legalHref("garantias")}>Guarantees and continuity</Link>.
          </p>
        </>
      ),
    },
    {
      title: "12. The code is open source",
      body: (
        <p>
          GDD Manager&apos;s code is open source under the {gpl} license, at {repo}. You may read it, run your own copy and modify it, following the
          rules of that license. These terms apply to the service we run; a copy run by someone else is the responsibility of whoever runs it.
        </p>
      ),
    },
    {
      title: "13. Ending things",
      body: (
        <>
          <p>
            You can stop using GDD whenever you like and delete your account and data — the steps are in{" "}
            <Link href={legalHref("esquecimento")}>Right to be forgotten</Link>. Before that, if you want, take everything with you through the
            export.
          </p>
          <p>We may suspend or close an account that breaks these terms. Whenever possible, we will warn you first and explain why.</p>
        </>
      ),
    },
    {
      title: "14. Changes to these terms",
      body: (
        <p>
          These terms may be updated. The date of the latest revision is at the top of this page. If a change is significant, we will let you know
          inside the app before it takes effect. Continuing to use GDD after that means accepting the new version.
        </p>
      ),
    },
    {
      title: "15. Governing law",
      body: (
        <p>
          These terms are governed by Brazilian law, including the General Data Protection Law (LGPD). How we handle your personal data is in the{" "}
          <Link href={legalHref("privacidade")}>Privacy policy</Link>. Before any dispute, write to {mail} — we would rather sort it out by talking.
        </p>
      ),
    },
  ],
};

const es: TermsContent = {
  summaryTitle: "En resumen",
  summary: (
    <ul className="ml-5 list-disc space-y-1.5">
      <li>Lo que escribes en GDD es tuyo. Nosotros solo lo guardamos, mostramos y sincronizamos para ti.</li>
      <li>La app funciona en tu navegador; enviarla a la nube es opcional, proyecto por proyecto.</li>
      <li>Hay un plan gratuito, con límites por proyecto que pueden cambiar.</li>
      <li>Cuando usas la IA, el texto va al proveedor de IA que elegiste, con tu propia clave.</li>
      <li>Si dejas que un agente (como Claude) trabaje en tu GDD, lo que haga en tu nombre es tu responsabilidad.</li>
      <li>El servicio se ofrece tal cual, sin garantía de que nunca se caiga — y el código es abierto.</li>
    </ul>
  ),
  sections: [
    {
      title: "1. Quién está del otro lado",
      body: (
        <>
          <p>
            GDD Manager lo mantiene <a href={LEGAL_OPERATOR_URL} target="_blank" rel="noopener noreferrer"><strong>{LEGAL_OPERATOR}</strong></a>. Al crear una cuenta o usar la app, aceptas estos términos. Si no estás de
            acuerdo, no pasa nada — simplemente no uses el servicio.
          </p>
          <p>Dudas, pedidos o reclamos: escribe a {mail}. Lo lee una persona.</p>
        </>
      ),
    },
    {
      title: "2. Qué es el servicio",
      body: (
        <p>
          GDD Manager es un lugar para escribir y recorrer el documento de diseño de tu juego: un árbol de páginas, con la visión del juego,
          documentación, una biblioteca de balanceo, mapa mental, modo documento, modo deck y exportación. Las funciones pueden agregarse, cambiar o
          desaparecer con el tiempo.
        </p>
      ),
    },
    {
      title: "3. Tu cuenta",
      body: (
        <>
          <p>
            Entras con correo y contraseña o con tu cuenta de Google. Cuida ese acceso: no compartas la contraseña y avísanos si crees que alguien
            entró en tu cuenta sin permiso. Lo que pasa dentro de una cuenta es responsabilidad de su dueño.
          </p>
          <p>Usa datos verdaderos al registrarte. Una cuenta es de una persona; para trabajar en equipo, invita a los demás al proyecto.</p>
        </>
      ),
    },
    {
      title: "4. Tu contenido sigue siendo tuyo",
      body: (
        <>
          <p>
            Todo lo que escribes — textos, tablas, imágenes que enlazas, la idea del juego — sigue siendo tuyo. No reclamamos ningún derecho sobre tu
            juego.
          </p>
          <p>
            Para que la app funcione, nos das un permiso limitado para <strong>guardar, mostrar y sincronizar</strong> ese contenido: mostrártelo a
            ti y a quienes invitaste, copiarlo entre el navegador y la nube, hacer copias de seguridad y generar las exportaciones que pidas. Ese
            permiso sirve solo para eso y termina cuando borras el contenido o la cuenta. No vendemos tu contenido ni lo usamos para promoción.
          </p>
          <p>Garantizas que tienes derecho a poner en GDD lo que pones (por ejemplo, imágenes de terceros).</p>
        </>
      ),
    },
    {
      title: "5. Uso aceptable",
      body: (
        <>
          <p>Usa GDD para documentar juegos y proyectos creativos. No vale:</p>
          <ul>
            <li>publicar o compartir contenido ilegal, que viole derechos de otras personas o que sirva para acosar a alguien;</li>
            <li>intentar acceder a proyectos o cuentas que no son tuyos, o saltarse los límites del plan;</li>
            <li>sobrecargar el servicio a propósito (por ejemplo, con automatizaciones que disparan pedidos sin parar);</li>
            <li>usar el servicio para propagar virus, spam o estafas.</li>
          </ul>
          <p>Si alguien hace esto, podemos quitar el contenido, o limitar o suspender la cuenta.</p>
        </>
      ),
    },
    {
      title: "6. Planes y límites",
      body: (
        <>
          <p>
            Hoy GDD tiene un plan gratuito. Tiene límites — de proyectos, de páginas por proyecto y de cuánto se sincroniza con la nube por hora. Los
            números actuales aparecen dentro de la app y pueden cambiar con el tiempo, hacia arriba o hacia abajo, según lo que cueste mantener el
            servicio.
          </p>
          <p>
            En un proyecto compartido, valen los límites del dueño del proyecto. Si se alcanza un límite, la app sigue funcionando en tu navegador;
            solo la nube espera.
          </p>
          <p>Si algún día existe un plan pago, sus condiciones se mostrarán antes de que contrates nada.</p>
        </>
      ),
    },
    {
      title: "7. Ayudas de IA",
      body: (
        <>
          <p>
            GDD tiene ayudas de IA para escribir: generar el GDD inicial a partir de una idea, importar un documento que ya tienes, mejorar el texto
            de una página, sugerir dónde encaja una página nueva y sugerir etiquetas. Son opcionales y solo funcionan después de configurar un
            proveedor de IA (Groq, OpenAI o Anthropic) con <strong>tu propia clave</strong>.
          </p>
          <p>
            Cuando usas una de ellas, el texto involucrado (tu idea, la página o partes del proyecto) pasa por nuestro servidor y se envía a ese
            proveedor. A partir de ahí también valen los términos y la política de privacidad de ese proveedor, y el costo del uso corre por tu cuenta
            con él.
          </p>
          <p>
            La IA se equivoca. Lo que sugiere es un borrador: revísalo antes de aceptarlo. No respondemos por lo que dice el texto generado ni
            garantizamos que sea original.
          </p>
        </>
      ),
    },
    {
      title: "8. Agentes, el conector de Claude y claves de API",
      body: (
        <>
          <p>
            Puedes conectar tu GDD a un agente de IA — con el conector de Claude o con el servidor MCP local y una clave de API — y también usar esas
            claves en tus propios scripts. El agente pasa a leer y escribir en GDD <strong>en tu nombre</strong>, con los mismos permisos que tienes
            tú.
          </p>
          <p>
            Por eso, lo que haga el agente (crear, cambiar o borrar páginas) cuenta como hecho por ti. Guarda las claves como guardas una contraseña,
            no las publiques, y revoca la clave o desconecta el conector cuando ya no lo necesites. Si una clave se filtra, revócala de inmediato en
            Configuración.
          </p>
        </>
      ),
    },
    {
      title: "9. Compartir y colaborar",
      body: (
        <>
          <p>
            Al invitar a alguien a un proyecto, esa persona puede ver todo el proyecto — y, si es editora, también cambiar y borrar páginas. Invita
            solo a quien deba tener ese acceso; puedes quitarla del proyecto cuando quieras.
          </p>
          <p>
            Al crear un <strong>enlace público</strong>, cualquiera con el enlace puede ver el proyecto, sin necesidad de cuenta. Solo lectura, pero
            abierto: trata el enlace como algo publicado. Desactiva el enlace para cerrar el acceso.
          </p>
        </>
      ),
    },
    {
      title: "10. Dónde viven tus datos",
      body: (
        <>
          <p>
            GDD funciona primero en tu navegador: tus proyectos se guardan ahí y puedes trabajar sin internet. La sincronización con la nube es
            opcional y se elige proyecto por proyecto.
          </p>
          <p>
            Eso tiene una parte que te toca a ti: si borras los datos del navegador o cambias de computadora sin haber sincronizado, lo que estaba
            solo ahí se pierde. Sincroniza o exporta lo importante — mira <Link href={legalHref("exportar")}>Exportar tus datos</Link>.
          </p>
        </>
      ),
    },
    {
      title: "11. Disponibilidad",
      body: (
        <>
          <p>
            Nos esforzamos para que GDD esté en línea y funcionando, pero se ofrece <strong>tal cual</strong>, sin garantía de disponibilidad
            continua, de ausencia de errores ni de que sirva para un fin específico. Puede haber mantenimiento, inestabilidad o cambios de funciones.
          </p>
          <p>
            En la medida en que la ley lo permita, {LEGAL_OPERATOR} no responde por pérdidas indirectas — como retrasos en el proyecto o datos que
            estaban solo en el navegador. Qué pasa con tu GDD si el sitio cambia o se cae está en{" "}
            <Link href={legalHref("garantias")}>Garantías y continuidad</Link>.
          </p>
        </>
      ),
    },
    {
      title: "12. El código es abierto",
      body: (
        <p>
          El código de GDD Manager es abierto, bajo la licencia {gpl}, y está en {repo}. Puedes leerlo, ejecutar tu propia copia y modificarlo,
          siguiendo las reglas de esa licencia. Estos términos valen para el servicio que mantenemos nosotros; una copia ejecutada por otra persona es
          responsabilidad de quien la ejecuta.
        </p>
      ),
    },
    {
      title: "13. Terminación",
      body: (
        <>
          <p>
            Puedes dejar de usar GDD cuando quieras y borrar tu cuenta y tus datos — los pasos están en{" "}
            <Link href={legalHref("esquecimento")}>Derecho al olvido</Link>. Antes, si quieres, llévate todo con la exportación.
          </p>
          <p>Podemos suspender o cerrar una cuenta que incumpla estos términos. Cuando sea posible, avisaremos antes y explicaremos el motivo.</p>
        </>
      ),
    },
    {
      title: "14. Cambios en estos términos",
      body: (
        <p>
          Estos términos pueden actualizarse. La fecha de la última revisión está al inicio de esta página. Si el cambio es importante, avisaremos
          dentro de la app antes de que entre en vigor. Seguir usando GDD después de eso significa aceptar la nueva versión.
        </p>
      ),
    },
    {
      title: "15. Ley aplicable",
      body: (
        <p>
          Estos términos se rigen por la ley brasileña, incluida la Ley General de Protección de Datos (LGPD). Cómo tratamos tus datos personales
          está en la <Link href={legalHref("privacidade")}>Política de privacidad</Link>. Antes de cualquier disputa, escribe a {mail} — preferimos
          resolverlo conversando.
        </p>
      ),
    },
  ],
};

export const TERMS_CONTENT: Record<AppLocale, TermsContent> = { "pt-BR": ptBR, en, es };
