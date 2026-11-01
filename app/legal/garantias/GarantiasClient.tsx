"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { LegalCallout, LegalHeader, LegalSection } from "@/components/legal/LegalArticle";
import { useI18n } from "@/lib/i18n/provider";
import type { AppLocale } from "@/lib/i18n/config";
import { LEGAL_APP_URL, LEGAL_CONTACT_EMAIL, LEGAL_OPERATOR, legalHref, pick } from "@/lib/legal/pages";

/**
 * Garantias e continuidade: o que acontece com o GDD de quem usa se o site
 * cair, mudar de endereço, de dono, de plano ou fechar.
 *
 * Cada afirmação aqui tem lastro no código — não mudar o texto sem conferir:
 * - dados no localStorage do navegador, que é separado por endereço
 *   (store/authStore.ts, signInWithGoogle volta para a mesma origem);
 * - nuvem só com login, automática ou pelo botão Sincronizar
 *   (PersistenceConfig.syncAutomatic); quem tem conta recebe a cópia da nuvem
 *   ao entrar (cloudSyncSlice.loadFromSupabase);
 * - falha de sync pausa e tenta de novo sozinha (syncEngine: circuit breaker);
 * - não há service worker: com o site fora do ar, uma aba nova não abre o app;
 * - backup JSON de todos os projetos com restauração em /backup; export por
 *   projeto em Markdown, PDF e Word (app/projects/[id]/export);
 * - código GPL-3.0 (LICENSE, package.json); o pacote MCP aceita GDD_API_URL.
 *
 * Os compromissos da seção "O que a gente promete" são promessas do dono do
 * projeto — mudar só com a aprovação dele, e atualizar LEGAL_UPDATED_AT.
 */

const REPO_URL = "https://github.com/Doublehitgames/GddApp";
const NEW_DOMAIN = new URL(LEGAL_APP_URL).host;
const OLD_DOMAIN = "gdd-app.vercel.app";

type Scenario = { icon: ReactNode; title: string; body: ReactNode };

type Copy = {
  summaryLabel: string;
  summary: ReactNode;
  whereTitle: string;
  where: ReactNode;
  scenariosTitle: string;
  scenariosIntro: string;
  scenarios: Scenario[];
  copiesTitle: string;
  copies: ReactNode;
  openTitle: string;
  open: ReactNode;
  promisesTitle: string;
  promisesIntro: string;
  promises: ReactNode[];
  contactTitle: string;
  contact: ReactNode;
};

/* Ícones simples, em traço, que herdam a cor do texto. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      {children}
    </svg>
  );
}
const IconCloudOff = (
  <Icon>
    <path d="M3 3l18 18" />
    <path d="M17.5 17.5H7a4 4 0 0 1-1.3-7.8M9.5 6.3A6 6 0 0 1 18 10a3.5 3.5 0 0 1 2.4 5.8" />
  </Icon>
);
const IconSignpost = (
  <Icon>
    <path d="M12 3v18" />
    <path d="M5 6h11l3 2.5L16 11H5z" />
    <path d="M19 14H8l-3 2.5L8 19h11z" />
  </Icon>
);
const IconHandshake = (
  <Icon>
    <path d="M3 12l4-4 3 2 3-3 4 2 4 3" />
    <path d="M7 15l3 3 2-1 2 2 3-2" />
    <path d="M3 12l4 3M21 12l-4 5" />
  </Icon>
);
const IconSliders = (
  <Icon>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </Icon>
);
const IconDoor = (
  <Icon>
    <path d="M5 21V4a1 1 0 0 1 1-1h9v18" />
    <path d="M15 5l4 1v15H3" />
    <circle cx="12" cy="12" r="0.6" fill="currentColor" />
  </Icon>
);
const IconLaptop = (
  <Icon>
    <rect x="4" y="5" width="16" height="11" rx="1.5" />
    <path d="M2 19h20" />
    <path d="M10 9l4 4M14 9l-4 4" />
  </Icon>
);

const COPY: Record<AppLocale, Copy> = {
  "pt-BR": {
    summaryLabel: "Em resumo",
    summary: (
      <>
        O seu GDD não depende só da gente. Ele mora no seu navegador, você baixa uma cópia em formatos abertos quando quiser, e o
        código do app é aberto — se um dia o site sumir, o seu texto continua seu e qualquer pessoa pode pôr outro GDD Manager no ar.
      </>
    ),
    whereTitle: "Onde o seu GDD mora",
    where: (
      <>
        <p>
          Tudo o que você escreve fica guardado <strong>no próprio navegador</strong>, no computador que você está usando. É por isso
          que o app abre rápido e continua funcionando mesmo quando a internet oscila.
        </p>
        <p>
          Com login, o app também guarda <strong>uma cópia na nuvem</strong> — sozinho, alguns segundos depois de cada edição, ou
          quando você clica em <em>Sincronizar</em>, conforme a sua configuração. Essa cópia é o que traz os seus projetos de volta em
          outro computador. Sem login, o GDD existe só naquele navegador.
        </p>
        <p>
          Um detalhe que importa para o resto desta página: o navegador guarda os dados <strong>separados por endereço</strong>. O que
          está salvo num endereço não aparece em outro, nem em outro navegador do mesmo computador.
        </p>
      </>
    ),
    scenariosTitle: "E se…",
    scenariosIntro: "Os casos que mais preocupam, um por um, sem enfeite.",
    scenarios: [
      {
        icon: IconCloudOff,
        title: "…o site sair do ar por um tempo?",
        body: (
          <>
            <p>
              Se o GDD já estava aberto, você segue escrevendo: as edições ficam salvas no navegador. A sincronização pausa, espera uns
              minutos se as falhas se repetem, e tenta de novo sozinha. Quando o site volta, ela manda o que ficou pendente.
            </p>
            <p>
              Uma aba nova não abre enquanto o site estiver fora — mas nada do que já está no seu navegador se perde por isso.
            </p>
          </>
        ),
      },
      {
        icon: IconSignpost,
        title: "…o site mudar de endereço?",
        body: (
          <>
            <p>
              Está acontecendo agora: o GDD está se mudando para <strong>{NEW_DOMAIN}</strong>, e o endereço antigo ({OLD_DOMAIN})
              continua funcionando durante a transição.
            </p>
            <p>
              Como o navegador separa os dados por endereço, o endereço novo abre vazio até você entrar. Antes de trocar,{" "}
              <strong>sincronize</strong> (aí é só entrar no novo e os projetos aparecem) ou, se você usa sem login,{" "}
              <strong>baixe o backup</strong> no endereço antigo e restaure no novo.
            </p>
          </>
        ),
      },
      {
        icon: IconHandshake,
        title: "…o GDD mudar de dono?",
        body: (
          <>
            <p>
              Se o app passar para outra pessoa ou empresa, ela assume estas garantias junto. Você fica sabendo antes da troca, com
              tempo de baixar tudo e, se não quiser continuar, <Link href={legalHref("esquecimento")}>apagar a sua conta</Link>.
            </p>
          </>
        ),
      },
      {
        icon: IconSliders,
        title: "…os planos mudarem?",
        body: (
          <>
            <p>
              Limites e planos podem mudar com o tempo. Um limite novo vale para o que você ainda vai criar: o que você já escreveu
              continua seu, para abrir, editar e exportar. Nada é apagado por ter passado de um limite.
            </p>
          </>
        ),
      },
      {
        icon: IconDoor,
        title: "…o GDD fechar de vez?",
        body: (
          <>
            <p>
              Você é avisado com pelo menos <strong>90 dias</strong> de antecedência, por e-mail e por um aviso dentro do app. A
              exportação funciona até o último dia. Depois do fechamento, a cópia na nuvem é apagada — e o código continua público
              para quem quiser seguir usando.
            </p>
          </>
        ),
      },
      {
        icon: IconLaptop,
        title: "…eu perder o computador ou limpar o navegador?",
        body: (
          <>
            <p>
              Aí o que estava só no navegador vai embora junto. Com login e sincronizado, é só entrar de novo que a cópia da nuvem
              volta. Sem login, o que salva é o backup que você baixou — por isso vale tirar um de vez em quando.
            </p>
          </>
        ),
      },
    ],
    copiesTitle: "Cópias que você tira quando quiser",
    copies: (
      <>
        <p>Você não precisa pedir nada a ninguém para ter o seu GDD em mãos:</p>
        <ul>
          <li>
            <Link href="/backup">Backup</Link>: um arquivo JSON com todos os seus projetos, que dá para restaurar aqui mesmo ou em
            outra cópia do app.
          </li>
          <li>Dentro de cada projeto, a exportação em Markdown, PDF ou Word, para ler, imprimir ou levar para outra ferramenta.</li>
        </ul>
        <p>
          São formatos abertos: abrem em qualquer editor de texto, sem o GDD Manager no meio. O passo a passo está em{" "}
          <Link href={legalHref("exportar")}>Exportar os dados</Link>.
        </p>
      </>
    ),
    openTitle: "O código é aberto",
    open: (
      <>
        <p>
          O GDD Manager é software livre, sob a licença <strong>GPL-3.0</strong>. O código está público em{" "}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
            github.com/Doublehitgames/GddApp
          </a>
          , e qualquer pessoa pode rodar a própria cópia — um estúdio, uma escola, você mesmo.
        </p>
        <p>
          A conexão do GDD com assistentes de IA (o pacote <code>@doublehitgames/gdd-mcp</code>) também pode apontar para essa
          cópia, em vez do nosso site. Ou seja: se a gente parar, a ferramenta não para junto.
        </p>
      </>
    ),
    promisesTitle: "O que a gente promete",
    promisesIntro: `Em nome da ${LEGAL_OPERATOR}, com todas as letras:`,
    promises: [
      <>
        Avisar com pelo menos <strong>90 dias</strong> de antecedência antes de fechar o GDD, por e-mail e por um aviso dentro do app.
      </>,
      <>Manter a exportação e o backup funcionando até o último dia.</>,
      <>Apagar a cópia dos seus dados guardada na nuvem depois do fechamento.</>,
      <>Manter o código público, para que o app possa continuar existindo sem a gente.</>,
      <>Avisar antes de uma mudança de endereço ou de dono, e manter o endereço antigo funcionando durante a transição.</>,
      <>Não apagar nem trancar o que você já escreveu por causa de uma mudança de plano ou de limite.</>,
    ],
    contactTitle: "Dúvidas",
    contact: (
      <p>
        Se alguma coisa aqui não ficou clara, ou se você quer ajuda para tirar os seus dados, escreva para{" "}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
      </p>
    ),
  },

  en: {
    summaryLabel: "In short",
    summary: (
      <>
        Your GDD doesn&apos;t depend on us alone. It lives in your browser, you can download a copy in open formats whenever you
        like, and the app&apos;s code is open — if the site ever disappears, your writing is still yours and anyone can put another
        GDD Manager online.
      </>
    ),
    whereTitle: "Where your GDD lives",
    where: (
      <>
        <p>
          Everything you write is stored <strong>in the browser itself</strong>, on the computer you are using. That is why the app
          opens fast and keeps working when the connection is shaky.
        </p>
        <p>
          When you are signed in, the app also keeps <strong>a copy in the cloud</strong> — on its own, a few seconds after each edit,
          or when you click <em>Sync</em>, depending on your settings. That copy is what brings your projects back on another
          computer. Without signing in, the GDD exists only in that browser.
        </p>
        <p>
          One detail that matters for the rest of this page: the browser keeps data <strong>separate for each address</strong>. What
          is saved under one address doesn&apos;t show up under another, nor in a different browser on the same computer.
        </p>
      </>
    ),
    scenariosTitle: "What if…",
    scenariosIntro: "The cases that worry people most, one at a time, no sugar-coating.",
    scenarios: [
      {
        icon: IconCloudOff,
        title: "…the site goes down for a while?",
        body: (
          <>
            <p>
              If your GDD was already open, you keep writing: edits are saved in the browser. Syncing pauses, waits a few minutes if
              failures keep happening, and tries again on its own. When the site is back, it sends whatever was pending.
            </p>
            <p>A new tab won&apos;t open while the site is down — but nothing already in your browser is lost because of it.</p>
          </>
        ),
      },
      {
        icon: IconSignpost,
        title: "…the site changes address?",
        body: (
          <>
            <p>
              It is happening right now: GDD is moving to <strong>{NEW_DOMAIN}</strong>, and the old address ({OLD_DOMAIN}) keeps
              working during the transition.
            </p>
            <p>
              Since the browser keeps data separate per address, the new address opens empty until you sign in. Before switching,{" "}
              <strong>sync</strong> (then just sign in at the new one and your projects appear) or, if you use it without an account,{" "}
              <strong>download the backup</strong> at the old address and restore it at the new one.
            </p>
          </>
        ),
      },
      {
        icon: IconHandshake,
        title: "…GDD changes owner?",
        body: (
          <>
            <p>
              If the app passes to another person or company, they take on these guarantees with it. You hear about it before the
              change, with time to download everything and, if you don&apos;t want to stay,{" "}
              <Link href={legalHref("esquecimento")}>delete your account</Link>.
            </p>
          </>
        ),
      },
      {
        icon: IconSliders,
        title: "…the plans change?",
        body: (
          <>
            <p>
              Limits and plans may change over time. A new limit applies to what you have yet to create: what you have already
              written stays yours, to open, edit and export. Nothing is deleted for going over a limit.
            </p>
          </>
        ),
      },
      {
        icon: IconDoor,
        title: "…GDD shuts down for good?",
        body: (
          <>
            <p>
              You get at least <strong>90 days</strong> of notice, by email and through a notice inside the app. Exporting works until
              the very last day. After the shutdown, the cloud copy is deleted — and the code stays public for anyone who wants to keep
              using it.
            </p>
          </>
        ),
      },
      {
        icon: IconLaptop,
        title: "…I lose my computer or clear my browser?",
        body: (
          <>
            <p>
              Then whatever was only in the browser goes with it. If you were signed in and synced, just sign in again and the cloud
              copy comes back. Without an account, what saves you is the backup you downloaded — so it is worth making one now and
              then.
            </p>
          </>
        ),
      },
    ],
    copiesTitle: "Copies you can make anytime",
    copies: (
      <>
        <p>You don&apos;t need to ask anyone to have your GDD in hand:</p>
        <ul>
          <li>
            <Link href="/backup">Backup</Link>: a JSON file with all your projects, which you can restore right here or in another copy
            of the app.
          </li>
          <li>Inside each project, export to Markdown, PDF or Word, to read, print or take to another tool.</li>
        </ul>
        <p>
          These are open formats: they open in any text editor, with no GDD Manager in between. The step by step is in{" "}
          <Link href={legalHref("exportar")}>Export your data</Link>.
        </p>
      </>
    ),
    openTitle: "The code is open",
    open: (
      <>
        <p>
          GDD Manager is free software, under the <strong>GPL-3.0</strong> license. The code is public at{" "}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
            github.com/Doublehitgames/GddApp
          </a>
          , and anyone can run their own copy — a studio, a school, you.
        </p>
        <p>
          The connection between GDD and AI assistants (the <code>@doublehitgames/gdd-mcp</code> package) can point to that copy too,
          instead of our site. In other words: if we stop, the tool doesn&apos;t stop with us.
        </p>
      </>
    ),
    promisesTitle: "What we promise",
    promisesIntro: `On behalf of ${LEGAL_OPERATOR}, in plain words:`,
    promises: [
      <>
        Give at least <strong>90 days</strong> of notice before shutting GDD down, by email and through a notice inside the app.
      </>,
      <>Keep export and backup working until the very last day.</>,
      <>Delete the copy of your data stored in the cloud after the shutdown.</>,
      <>Keep the code public, so the app can go on existing without us.</>,
      <>Give notice before a change of address or owner, and keep the old address working during the transition.</>,
      <>Never delete or lock what you have already written because of a plan or limit change.</>,
    ],
    contactTitle: "Questions",
    contact: (
      <p>
        If anything here is unclear, or you want help getting your data out, write to{" "}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
      </p>
    ),
  },

  es: {
    summaryLabel: "En resumen",
    summary: (
      <>
        Tu GDD no depende solo de nosotros. Vive en tu navegador, puedes descargar una copia en formatos abiertos cuando quieras, y el
        código de la app es abierto: si algún día el sitio desaparece, tu texto sigue siendo tuyo y cualquiera puede poner otro GDD
        Manager en línea.
      </>
    ),
    whereTitle: "Dónde vive tu GDD",
    where: (
      <>
        <p>
          Todo lo que escribes se guarda <strong>en el propio navegador</strong>, en el ordenador que estás usando. Por eso la app
          abre rápido y sigue funcionando aunque la conexión falle.
        </p>
        <p>
          Con sesión iniciada, la app también guarda <strong>una copia en la nube</strong>: sola, unos segundos después de cada
          edición, o cuando pulsas <em>Sincronizar</em>, según tu configuración. Esa copia es la que trae tus proyectos de vuelta en
          otro ordenador. Sin iniciar sesión, el GDD existe solo en ese navegador.
        </p>
        <p>
          Un detalle que importa para el resto de esta página: el navegador guarda los datos <strong>separados por dirección</strong>.
          Lo que está guardado en una dirección no aparece en otra, ni en otro navegador del mismo ordenador.
        </p>
      </>
    ),
    scenariosTitle: "¿Y si…?",
    scenariosIntro: "Los casos que más preocupan, uno por uno, sin adornos.",
    scenarios: [
      {
        icon: IconCloudOff,
        title: "…el sitio se cae un tiempo?",
        body: (
          <>
            <p>
              Si el GDD ya estaba abierto, sigues escribiendo: los cambios se guardan en el navegador. La sincronización se pausa,
              espera unos minutos si los fallos se repiten y vuelve a intentarlo sola. Cuando el sitio vuelve, envía lo que quedó
              pendiente.
            </p>
            <p>Una pestaña nueva no abre mientras el sitio esté caído, pero nada de lo que ya está en tu navegador se pierde por eso.</p>
          </>
        ),
      },
      {
        icon: IconSignpost,
        title: "…el sitio cambia de dirección?",
        body: (
          <>
            <p>
              Está pasando ahora: GDD se está mudando a <strong>{NEW_DOMAIN}</strong>, y la dirección antigua ({OLD_DOMAIN}) sigue
              funcionando durante la transición.
            </p>
            <p>
              Como el navegador separa los datos por dirección, la nueva abre vacía hasta que inicias sesión. Antes de cambiar,{" "}
              <strong>sincroniza</strong> (luego basta con entrar en la nueva y tus proyectos aparecen) o, si la usas sin cuenta,{" "}
              <strong>descarga la copia de seguridad</strong> en la dirección antigua y restáurala en la nueva.
            </p>
          </>
        ),
      },
      {
        icon: IconHandshake,
        title: "…GDD cambia de dueño?",
        body: (
          <>
            <p>
              Si la app pasa a otra persona o empresa, asume estas garantías con ella. Te enteras antes del cambio, con tiempo para
              descargarlo todo y, si no quieres seguir, <Link href={legalHref("esquecimento")}>borrar tu cuenta</Link>.
            </p>
          </>
        ),
      },
      {
        icon: IconSliders,
        title: "…cambian los planes?",
        body: (
          <>
            <p>
              Los límites y los planes pueden cambiar con el tiempo. Un límite nuevo vale para lo que aún vas a crear: lo que ya
              escribiste sigue siendo tuyo, para abrir, editar y exportar. Nada se borra por haber pasado un límite.
            </p>
          </>
        ),
      },
      {
        icon: IconDoor,
        title: "…GDD cierra para siempre?",
        body: (
          <>
            <p>
              Te avisamos con al menos <strong>90 días</strong> de antelación, por correo y con un aviso dentro de la app. La
              exportación funciona hasta el último día. Después del cierre, la copia en la nube se borra, y el código sigue público
              para quien quiera seguir usándolo.
            </p>
          </>
        ),
      },
      {
        icon: IconLaptop,
        title: "…pierdo el ordenador o borro el navegador?",
        body: (
          <>
            <p>
              Entonces lo que estaba solo en el navegador se va con él. Con sesión iniciada y sincronizado, basta con volver a entrar
              y la copia de la nube regresa. Sin cuenta, lo que te salva es la copia de seguridad que descargaste; por eso conviene
              hacer una de vez en cuando.
            </p>
          </>
        ),
      },
    ],
    copiesTitle: "Copias que haces cuando quieras",
    copies: (
      <>
        <p>No necesitas pedirle nada a nadie para tener tu GDD en la mano:</p>
        <ul>
          <li>
            <Link href="/backup">Copia de seguridad</Link>: un archivo JSON con todos tus proyectos, que puedes restaurar aquí mismo o
            en otra copia de la app.
          </li>
          <li>Dentro de cada proyecto, la exportación a Markdown, PDF o Word, para leer, imprimir o llevar a otra herramienta.</li>
        </ul>
        <p>
          Son formatos abiertos: se abren en cualquier editor de texto, sin GDD Manager de por medio. El paso a paso está en{" "}
          <Link href={legalHref("exportar")}>Exportar tus datos</Link>.
        </p>
      </>
    ),
    openTitle: "El código es abierto",
    open: (
      <>
        <p>
          GDD Manager es software libre, bajo la licencia <strong>GPL-3.0</strong>. El código es público en{" "}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
            github.com/Doublehitgames/GddApp
          </a>
          , y cualquiera puede ejecutar su propia copia: un estudio, una escuela, tú.
        </p>
        <p>
          La conexión de GDD con asistentes de IA (el paquete <code>@doublehitgames/gdd-mcp</code>) también puede apuntar a esa
          copia en lugar de a nuestro sitio. Es decir: si nosotros paramos, la herramienta no se detiene con nosotros.
        </p>
      </>
    ),
    promisesTitle: "Lo que prometemos",
    promisesIntro: `En nombre de ${LEGAL_OPERATOR}, con todas las letras:`,
    promises: [
      <>
        Avisar con al menos <strong>90 días</strong> de antelación antes de cerrar GDD, por correo y con un aviso dentro de la app.
      </>,
      <>Mantener la exportación y la copia de seguridad funcionando hasta el último día.</>,
      <>Borrar la copia de tus datos guardada en la nube después del cierre.</>,
      <>Mantener el código público, para que la app pueda seguir existiendo sin nosotros.</>,
      <>Avisar antes de un cambio de dirección o de dueño, y mantener la dirección antigua funcionando durante la transición.</>,
      <>No borrar ni bloquear lo que ya escribiste por un cambio de plan o de límite.</>,
    ],
    contactTitle: "Dudas",
    contact: (
      <p>
        Si algo aquí no quedó claro, o quieres ayuda para sacar tus datos, escribe a{" "}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
      </p>
    ),
  },
};

export function GarantiasClient() {
  const { locale } = useI18n();
  const c = pick(COPY, locale);

  return (
    <article>
      <LegalHeader slug="garantias" />

      <LegalCallout tone="danger">
        <strong className="mb-1 block text-xs font-semibold uppercase tracking-wider text-danger">{c.summaryLabel}</strong>
        {c.summary}
      </LegalCallout>

      <LegalSection title={c.whereTitle}>{c.where}</LegalSection>

      <section className="mb-8">
        <h2 className="mb-1 text-xl font-semibold tracking-tight text-ink">{c.scenariosTitle}</h2>
        <p className="mb-4 text-[15px] text-muted">{c.scenariosIntro}</p>
        <ul className="grid gap-3 md:grid-cols-2">
          {c.scenarios.map((s) => (
            <li key={s.title} className="flex flex-col rounded-2xl border border-line bg-surface p-4">
              <div className="mb-2 flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-danger-soft text-danger">{s.icon}</span>
                <h3 className="text-[15px] font-semibold leading-snug text-ink">{s.title}</h3>
              </div>
              <div className="space-y-2 text-sm leading-relaxed text-muted [&_a]:font-medium [&_a]:text-accent [&_a]:underline-offset-2 hover:[&_a]:underline [&_strong]:font-semibold [&_strong]:text-ink">
                {s.body}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <LegalSection title={c.copiesTitle}>{c.copies}</LegalSection>

      <LegalSection title={c.openTitle}>{c.open}</LegalSection>

      <LegalSection title={c.promisesTitle}>
        <p>{c.promisesIntro}</p>
        <ol className="rounded-2xl border border-danger/30 bg-danger-soft py-4 pl-6 pr-4">
          {c.promises.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ol>
      </LegalSection>

      <LegalSection title={c.contactTitle}>{c.contact}</LegalSection>
    </article>
  );
}
