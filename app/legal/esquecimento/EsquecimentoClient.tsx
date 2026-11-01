"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { LegalCallout, LegalHeader, LegalSection } from "@/components/legal/LegalArticle";
import { LEGAL_CONTACT_EMAIL, legalHref, pick } from "@/lib/legal/pages";
import { useI18n } from "@/lib/i18n/provider";
import type { AppLocale } from "@/lib/i18n/config";
import { useAuthStore } from "@/store/authStore";
import { useProjectStore } from "@/store/projectStore";
import { createClient } from "@/lib/supabase/client";
import type { AccountSummary } from "@/lib/account/deleteAccount";

/** Marca na URL para mostrar o "conta apagada" depois do recarregamento. */
const DONE_PARAM = "conta";
const DONE_VALUE = "apagada";

/** Preferências do aparelho, não dados da pessoa: ficam. */
const KEEP_KEYS = new Set(["gdd_theme", "gdd_locale"]);

/**
 * Apaga deste navegador tudo o que o GDD guardou: projetos, fila de sync,
 * fluxogramas, roadmap, config de IA, área de transferência do fluxograma…
 * Todas as chaves do app começam com "gdd_" ou "gdd:".
 */
function wipeBrowserData() {
  for (const storage of [safeStorage("local"), safeStorage("session")]) {
    if (!storage) continue;
    try {
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k && /^gdd[_:]/.test(k) && !KEEP_KEYS.has(k)) keys.push(k);
      }
      keys.forEach((k) => storage.removeItem(k));
    } catch {
      /* navegador sem storage: não há o que apagar */
    }
  }
}

function safeStorage(kind: "local" | "session"): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function hasBrowserData(): boolean {
  const s = safeStorage("local");
  if (!s) return false;
  try {
    const raw = s.getItem("gdd_projects_v1");
    return !!raw && raw !== "[]";
  } catch {
    return false;
  }
}

/** Esvazia o que está na memória para que o "salvar ao sair da página" não regrave nada. */
function emptyMemoryStore() {
  useProjectStore.setState({ projects: [], diagramsBySection: {} });
}

/** Leituras do navegador que não mudam enquanto a página está aberta. */
const noSubscribe = () => () => {};

function readDone(): boolean {
  try {
    return new URLSearchParams(window.location.search).get(DONE_PARAM) === DONE_VALUE;
  } catch {
    return false;
  }
}

function plural(locale: AppLocale, n: number, one: Record<AppLocale, string>, many: Record<AppLocale, string>) {
  return `${n} ${pick(n === 1 ? one : many, locale)}`;
}

const T = {
  oneLine: {
    "pt-BR": (
      <>
        <strong>Em uma frase:</strong> apagar a conta tira do GDD tudo o que é seu, de uma vez e para sempre. Não existe lixeira e
        ninguém consegue desfazer — nem nós.
      </>
    ),
    en: (
      <>
        <strong>In one sentence:</strong> deleting your account removes everything that is yours from GDD, at once and for good. There is no
        trash can and nobody can undo it — not even us.
      </>
    ),
    es: (
      <>
        <strong>En una frase:</strong> borrar la cuenta quita de GDD todo lo que es tuyo, de una vez y para siempre. No hay papelera y nadie
        puede deshacerlo — ni nosotros.
      </>
    ),
  },
  whatTitle: { "pt-BR": "O que é apagado", en: "What gets deleted", es: "Qué se borra" },
  what: {
    "pt-BR": (
      <ul>
        <li>
          <strong>Todos os projetos que você criou</strong>, com todas as páginas, tabelas, fluxogramas, mapa mental, visão do jogo e o
          histórico de versões e de mudanças.
        </li>
        <li>Os links públicos de leitura desses projetos param de abrir.</li>
        <li>Sua participação nos projetos de outras pessoas: você sai deles.</li>
        <li>As chaves de API e as conexões com outros apps (como o conector do Claude). Elas param de funcionar na hora.</li>
        <li>Seu perfil: nome, e-mail, foto e as preferências de IA.</li>
        <li>O seu login. Depois disso, entrar com o mesmo e-mail cria uma conta nova, vazia.</li>
      </ul>
    ),
    en: (
      <ul>
        <li>
          <strong>Every project you created</strong>, with all its pages, tables, flowcharts, mind map, game vision and the history of
          versions and changes.
        </li>
        <li>Public read-only links to those projects stop opening.</li>
        <li>Your membership in other people&apos;s projects: you leave them.</li>
        <li>Your API keys and connections to other apps (like the Claude connector). They stop working right away.</li>
        <li>Your profile: name, e-mail, photo and AI preferences.</li>
        <li>Your login. After that, signing in with the same e-mail creates a new, empty account.</li>
      </ul>
    ),
    es: (
      <ul>
        <li>
          <strong>Todos los proyectos que creaste</strong>, con todas sus páginas, tablas, diagramas de flujo, mapa mental, visión del juego
          y el historial de versiones y cambios.
        </li>
        <li>Los enlaces públicos de lectura de esos proyectos dejan de abrirse.</li>
        <li>Tu participación en los proyectos de otras personas: sales de ellos.</li>
        <li>Tus claves de API y las conexiones con otras apps (como el conector de Claude). Dejan de funcionar al instante.</li>
        <li>Tu perfil: nombre, correo, foto y preferencias de IA.</li>
        <li>Tu acceso. Después, entrar con el mismo correo crea una cuenta nueva y vacía.</li>
      </ul>
    ),
  },
  stayTitle: { "pt-BR": "O que fica", en: "What stays", es: "Qué queda" },
  stay: {
    "pt-BR": (
      <ul>
        <li>
          O que você escreveu nos projetos <strong>de outras pessoas</strong> continua lá, porque faz parte do documento delas. O seu nome
          sai do histórico desses projetos.
        </li>
        <li>As imagens da sua pasta do Google Drive: elas sempre foram suas, no seu Drive, e o GDD só apontava para elas.</li>
        <li>Os arquivos que você já exportou e baixou (PDF, Word, markdown).</li>
        <li>A cópia que outros navegadores ou computadores guardaram — veja abaixo.</li>
      </ul>
    ),
    en: (
      <ul>
        <li>
          What you wrote in <strong>other people&apos;s</strong> projects stays there, because it is part of their document. Your name is
          removed from those projects&apos; history.
        </li>
        <li>The images in your Google Drive folder: they were always yours, in your Drive, and GDD only pointed to them.</li>
        <li>Files you already exported and downloaded (PDF, Word, markdown).</li>
        <li>The copy kept by other browsers or computers — see below.</li>
      </ul>
    ),
    es: (
      <ul>
        <li>
          Lo que escribiste en proyectos <strong>de otras personas</strong> sigue ahí, porque es parte de su documento. Tu nombre sale del
          historial de esos proyectos.
        </li>
        <li>Las imágenes de tu carpeta de Google Drive: siempre fueron tuyas, en tu Drive, y GDD solo apuntaba a ellas.</li>
        <li>Los archivos que ya exportaste y descargaste (PDF, Word, markdown).</li>
        <li>La copia que guardaron otros navegadores u ordenadores — mira abajo.</li>
      </ul>
    ),
  },
  sharedTitle: { "pt-BR": "Projetos que você compartilhou", en: "Projects you shared", es: "Proyectos que compartiste" },
  shared: {
    "pt-BR": (
      <p>
        Se você é dono de um projeto e convidou outras pessoas, <strong>o projeto é apagado para todo mundo</strong>: quem foi convidado
        perde o acesso no mesmo instante. Se quiser que o projeto continue vivo, passe a posse para um editor nas configurações do projeto
        antes de apagar a conta.
      </p>
    ),
    en: (
      <p>
        If you own a project and invited other people, <strong>the project is deleted for everyone</strong>: the people you invited lose
        access at the same moment. If you want the project to live on, hand ownership to an editor in the project settings before deleting
        your account.
      </p>
    ),
    es: (
      <p>
        Si eres dueño de un proyecto e invitaste a otras personas, <strong>el proyecto se borra para todos</strong>: quienes invitaste
        pierden el acceso en ese mismo momento. Si quieres que el proyecto siga, pasa la propiedad a un editor en la configuración del
        proyecto antes de borrar la cuenta.
      </p>
    ),
  },
  localTitle: { "pt-BR": "A cópia neste navegador", en: "The copy in this browser", es: "La copia en este navegador" },
  local: {
    "pt-BR": (
      <p>
        O GDD guarda uma cópia dos seus projetos no próprio navegador, para funcionar sem internet. Quando você apaga a conta por aqui,
        essa cópia <strong>também é apagada deste navegador</strong>. Em outro computador ou navegador que você tenha usado, a cópia fica
        lá até você abrir o GDD nele e limpar os dados do site — ela não sincroniza mais com nada.
      </p>
    ),
    en: (
      <p>
        GDD keeps a copy of your projects in the browser itself, so it works offline. When you delete your account here, that copy{" "}
        <strong>is also erased from this browser</strong>. On another computer or browser you used, the copy stays until you open GDD
        there and clear the site data — it no longer syncs with anything.
      </p>
    ),
    es: (
      <p>
        GDD guarda una copia de tus proyectos en el propio navegador, para funcionar sin internet. Cuando borras la cuenta desde aquí, esa
        copia <strong>también se borra de este navegador</strong>. En otro ordenador o navegador que hayas usado, la copia queda ahí hasta
        que abras GDD en él y borres los datos del sitio — ya no se sincroniza con nada.
      </p>
    ),
  },
  exportTitle: { "pt-BR": "Antes de apagar, leve uma cópia", en: "Before deleting, take a copy", es: "Antes de borrar, llévate una copia" },
  export: {
    "pt-BR": (
      <p>
        Depois de apagado, não há como recuperar. Se existe a chance de você querer esse material de volta, <Link href={legalHref("exportar")}>exporte os seus projetos</Link> primeiro.
      </p>
    ),
    en: (
      <p>
        Once deleted, there is no way back. If there is any chance you will want this material again, <Link href={legalHref("exportar")}>export your projects</Link> first.
      </p>
    ),
    es: (
      <p>
        Una vez borrado, no hay vuelta atrás. Si existe la posibilidad de que quieras este material de nuevo, <Link href={legalHref("exportar")}>exporta tus proyectos</Link> primero.
      </p>
    ),
  },
  noAccessTitle: { "pt-BR": "Sem acesso à conta?", en: "Can't get into your account?", es: "¿Sin acceso a la cuenta?" },
  noAccess: {
    "pt-BR": (
      <p>
        Se você não consegue mais entrar, escreva para <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> a partir do
        e-mail da conta, pedindo para apagá-la. A gente confirma que o pedido veio de você e apaga tudo, do mesmo jeito.
      </p>
    ),
    en: (
      <p>
        If you can no longer sign in, write to <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> from the account&apos;s
        e-mail asking for it to be deleted. We confirm the request came from you and delete everything, the same way.
      </p>
    ),
    es: (
      <p>
        Si ya no puedes entrar, escribe a <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> desde el correo de la cuenta
        pidiendo borrarla. Confirmamos que la solicitud vino de ti y borramos todo, de la misma forma.
      </p>
    ),
  },
  zoneTitle: { "pt-BR": "Apagar a minha conta", en: "Delete my account", es: "Borrar mi cuenta" },
  signedInAs: { "pt-BR": "Você está na conta", en: "You are signed in as", es: "Estás en la cuenta" },
  willDelete: { "pt-BR": "Isto vai apagar:", en: "This will delete:", es: "Esto va a borrar:" },
  loadingSummary: { "pt-BR": "Contando o que é seu…", en: "Counting what is yours…", es: "Contando lo que es tuyo…" },
  summaryError: {
    "pt-BR": "Não deu para contar agora. Você ainda pode apagar a conta; o que está descrito acima vale do mesmo jeito.",
    en: "Couldn't count right now. You can still delete the account; everything described above still applies.",
    es: "No se pudo contar ahora. Aún puedes borrar la cuenta; todo lo descrito arriba vale igual.",
  },
  projectOne: { "pt-BR": "projeto seu", en: "project of yours", es: "proyecto tuyo" },
  projectMany: { "pt-BR": "projetos seus", en: "projects of yours", es: "proyectos tuyos" },
  sharedOne: {
    "pt-BR": "desses está compartilhado — quem foi convidado perde o acesso",
    en: "of them is shared — the people invited lose access",
    es: "de ellos está compartido — quienes fueron invitados pierden el acceso",
  },
  sharedMany: {
    "pt-BR": "desses estão compartilhados — quem foi convidado perde o acesso",
    en: "of them are shared — the people invited lose access",
    es: "de ellos están compartidos — quienes fueron invitados pierden el acceso",
  },
  peopleOne: { "pt-BR": "pessoa", en: "person", es: "persona" },
  peopleMany: { "pt-BR": "pessoas", en: "people", es: "personas" },
  membershipOne: {
    "pt-BR": "projeto de outra pessoa de onde você sai",
    en: "project by someone else that you leave",
    es: "proyecto de otra persona del que sales",
  },
  membershipMany: {
    "pt-BR": "projetos de outras pessoas de onde você sai",
    en: "projects by other people that you leave",
    es: "proyectos de otras personas de los que sales",
  },
  keyOne: { "pt-BR": "chave de API", en: "API key", es: "clave de API" },
  keyMany: { "pt-BR": "chaves de API", en: "API keys", es: "claves de API" },
  connOne: { "pt-BR": "app conectado", en: "connected app", es: "app conectada" },
  connMany: { "pt-BR": "apps conectados", en: "connected apps", es: "apps conectadas" },
  profileLine: {
    "pt-BR": "seu perfil, seu login e a cópia neste navegador",
    en: "your profile, your login and the copy in this browser",
    es: "tu perfil, tu acceso y la copia en este navegador",
  },
  typeEmail: {
    "pt-BR": "Para confirmar, digite o e-mail da conta:",
    en: "To confirm, type the account e-mail:",
    es: "Para confirmar, escribe el correo de la cuenta:",
  },
  button: { "pt-BR": "Apagar a conta para sempre", en: "Delete the account for good", es: "Borrar la cuenta para siempre" },
  deleting: { "pt-BR": "Apagando…", en: "Deleting…", es: "Borrando…" },
  errGeneric: {
    "pt-BR": "Não deu para apagar agora. Pode tentar de novo daqui a pouco, sem risco, ou escrever para",
    en: "Couldn't delete right now. You can safely try again in a moment, or write to",
    es: "No se pudo borrar ahora. Puedes intentarlo de nuevo en un momento, o escribe a",
  },
  errMismatch: {
    "pt-BR": "O e-mail digitado não é o desta conta.",
    en: "The e-mail you typed is not this account's.",
    es: "El correo escrito no es el de esta cuenta.",
  },
  errRate: {
    "pt-BR": "Muitas tentativas seguidas. Espere uns minutos e tente de novo.",
    en: "Too many attempts in a row. Wait a few minutes and try again.",
    es: "Demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo.",
  },
  errSession: {
    "pt-BR": "Sua sessão expirou. Entre de novo para apagar a conta.",
    en: "Your session expired. Sign in again to delete the account.",
    es: "Tu sesión expiró. Entra de nuevo para borrar la cuenta.",
  },
  errNoEmail: {
    "pt-BR": "Esta conta não tem e-mail para confirmar. Escreva para",
    en: "This account has no e-mail to confirm with. Write to",
    es: "Esta cuenta no tiene correo para confirmar. Escribe a",
  },
  signedOutTitle: { "pt-BR": "Entre para apagar a conta", en: "Sign in to delete the account", es: "Entra para borrar la cuenta" },
  signedOut: {
    "pt-BR": "Por segurança, só quem está dentro da conta consegue apagá-la.",
    en: "For safety, only someone signed in to the account can delete it.",
    es: "Por seguridad, solo quien está dentro de la cuenta puede borrarla.",
  },
  signIn: { "pt-BR": "Entrar", en: "Sign in", es: "Entrar" },
  localOnlyTitle: {
    "pt-BR": "Usa o GDD sem conta?",
    en: "Using GDD without an account?",
    es: "¿Usas GDD sin cuenta?",
  },
  localOnly: {
    "pt-BR": "Então os seus projetos só existem neste navegador. Você pode apagá-los daqui:",
    en: "Then your projects only exist in this browser. You can erase them here:",
    es: "Entonces tus proyectos solo existen en este navegador. Puedes borrarlos aquí:",
  },
  localOnlyButton: {
    "pt-BR": "Apagar os dados deste navegador",
    en: "Erase this browser's data",
    es: "Borrar los datos de este navegador",
  },
  localOnlyConfirm: {
    "pt-BR": "Apagar todos os projetos guardados neste navegador? Não dá para desfazer.",
    en: "Erase every project stored in this browser? This can't be undone.",
    es: "¿Borrar todos los proyectos guardados en este navegador? No se puede deshacer.",
  },
  localOnlyDone: {
    "pt-BR": "Pronto: este navegador não guarda mais nenhum projeto.",
    en: "Done: this browser no longer stores any project.",
    es: "Listo: este navegador ya no guarda ningún proyecto.",
  },
  doneTitle: { "pt-BR": "Conta apagada", en: "Account deleted", es: "Cuenta borrada" },
  done: {
    "pt-BR": "Sua conta e tudo o que era seu saíram do GDD, e a cópia deste navegador foi apagada. Obrigado por ter usado.",
    en: "Your account and everything that was yours are gone from GDD, and this browser's copy was erased. Thanks for having used it.",
    es: "Tu cuenta y todo lo que era tuyo salieron de GDD, y la copia de este navegador se borró. Gracias por haberlo usado.",
  },
  backHome: { "pt-BR": "Ir para o início", en: "Go to the start page", es: "Ir al inicio" },
};

type Phase = "idle" | "deleting" | "error";

export default function EsquecimentoClient() {
  const { locale } = useI18n();
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const done = useSyncExternalStore(noSubscribe, readDone, () => false);

  return (
    <article>
      <LegalHeader slug="esquecimento" />

      {done ? (
        <LegalCallout>
          <h2 className="text-xl font-semibold tracking-tight text-ink">{pick(T.doneTitle, locale)}</h2>
          <p className="mt-2 text-muted">{pick(T.done, locale)}</p>
          <Link href="/" className="mt-4 inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent hover:opacity-90">
            {pick(T.backHome, locale)}
          </Link>
        </LegalCallout>
      ) : (
        <LegalCallout tone="danger">{pick(T.oneLine, locale)}</LegalCallout>
      )}

      <LegalSection title={pick(T.whatTitle, locale)}>{pick(T.what, locale)}</LegalSection>
      <LegalSection title={pick(T.stayTitle, locale)}>{pick(T.stay, locale)}</LegalSection>
      <LegalSection title={pick(T.sharedTitle, locale)}>{pick(T.shared, locale)}</LegalSection>
      <LegalSection title={pick(T.localTitle, locale)}>{pick(T.local, locale)}</LegalSection>
      <LegalSection title={pick(T.exportTitle, locale)}>{pick(T.export, locale)}</LegalSection>

      {!done && (
        <section id="apagar" className="mb-8 rounded-2xl border border-danger/40 bg-surface p-5 md:p-6">
          <h2 className="text-xl font-semibold tracking-tight text-danger">{pick(T.zoneTitle, locale)}</h2>
          {authLoading ? (
            <div className="mt-4 h-24 animate-pulse rounded-xl bg-surface-2" />
          ) : user ? (
            <DangerZone locale={locale} email={user.email ?? null} />
          ) : (
            <SignedOutZone locale={locale} />
          )}
        </section>
      )}

      <LegalSection title={pick(T.noAccessTitle, locale)}>{pick(T.noAccess, locale)}</LegalSection>
    </article>
  );
}

function SignedOutZone({ locale }: { locale: AppLocale }) {
  const localData = useSyncExternalStore(noSubscribe, hasBrowserData, () => false);
  const [wiped, setWiped] = useState(false);

  return (
    <div className="mt-3 space-y-4 text-[15px] leading-relaxed">
      <div>
        <p className="font-semibold text-ink">{pick(T.signedOutTitle, locale)}</p>
        <p className="mt-1 text-muted">{pick(T.signedOut, locale)}</p>
        <Link
          href="/login?next=/legal/esquecimento"
          className="mt-3 inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent hover:opacity-90"
        >
          {pick(T.signIn, locale)}
        </Link>
      </div>
      {(localData || wiped) && (
        <div className="border-t border-line pt-4">
          <p className="font-semibold text-ink">{pick(T.localOnlyTitle, locale)}</p>
          {wiped ? (
            <p className="mt-1 text-muted">{pick(T.localOnlyDone, locale)}</p>
          ) : (
            <>
              <p className="mt-1 text-muted">{pick(T.localOnly, locale)}</p>
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm(pick(T.localOnlyConfirm, locale))) return;
                  emptyMemoryStore();
                  wipeBrowserData();
                  setWiped(true);
                }}
                className="mt-3 inline-flex h-9 items-center rounded-lg border border-danger/50 bg-danger-soft px-4 text-sm font-semibold text-danger hover:opacity-90"
              >
                {pick(T.localOnlyButton, locale)}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DangerZone({ locale, email }: { locale: AppLocale; email: string | null }) {
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<{ text: string; withEmail: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/account", { credentials: "same-origin" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { summary: AccountSummary };
        if (alive) setSummary(body.summary);
      })
      .catch(() => {
        if (alive) setSummaryFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const matches = !!email && typed.trim().toLowerCase() === email.trim().toLowerCase();

  const onDelete = async () => {
    if (!matches || phase === "deleting") return;
    setPhase("deleting");
    setError(null);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: typed.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { code?: string };
        const code = body.code;
        setPhase("error");
        if (code === "confirmation_mismatch") setError({ text: pick(T.errMismatch, locale), withEmail: false });
        else if (code === "rate_limit") setError({ text: pick(T.errRate, locale), withEmail: false });
        else if (code === "unauthenticated") setError({ text: pick(T.errSession, locale), withEmail: false });
        else if (code === "no_email") setError({ text: pick(T.errNoEmail, locale), withEmail: true });
        else setError({ text: pick(T.errGeneric, locale), withEmail: true });
        return;
      }

      // A conta não existe mais. Agora: memória vazia → storage limpo → sair →
      // limpar de novo (o sair dispara um recarregamento do storage e o
      // "salvar ao sair da página") → recarregar a página no estado final.
      emptyMemoryStore();
      wipeBrowserData();
      try {
        await createClient().auth.signOut({ scope: "local" });
      } catch {
        /* a sessão já era inválida */
      }
      useAuthStore.setState({ user: null, session: null, profile: null });
      emptyMemoryStore();
      wipeBrowserData();
      window.location.replace(`/legal/esquecimento?${DONE_PARAM}=${DONE_VALUE}`);
    } catch {
      setPhase("error");
      setError({ text: pick(T.errGeneric, locale), withEmail: true });
    }
  };

  const lines: string[] = [];
  if (summary) {
    lines.push(plural(locale, summary.ownedProjects, T.projectOne, T.projectMany));
    if (summary.sharedOwnedProjects > 0) {
      lines.push(
        `${summary.sharedOwnedProjects} ${pick(summary.sharedOwnedProjects === 1 ? T.sharedOne : T.sharedMany, locale)} (${plural(
          locale,
          summary.membersAffected,
          T.peopleOne,
          T.peopleMany,
        )})`,
      );
    }
    if (summary.memberships > 0) lines.push(plural(locale, summary.memberships, T.membershipOne, T.membershipMany));
    if (summary.apiKeys > 0) lines.push(plural(locale, summary.apiKeys, T.keyOne, T.keyMany));
    if (summary.connections > 0) lines.push(plural(locale, summary.connections, T.connOne, T.connMany));
    lines.push(pick(T.profileLine, locale));
  }

  return (
    <div className="mt-3 space-y-4 text-[15px] leading-relaxed text-ink">
      {email && (
        <p className="text-muted">
          {pick(T.signedInAs, locale)} <strong className="font-semibold text-ink">{email}</strong>
        </p>
      )}

      <div className="rounded-xl bg-danger-soft p-4">
        <p className="font-semibold">{pick(T.willDelete, locale)}</p>
        {summary ? (
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        ) : summaryFailed ? (
          <p className="mt-2 text-muted">{pick(T.summaryError, locale)}</p>
        ) : (
          <p className="mt-2 text-muted">{pick(T.loadingSummary, locale)}</p>
        )}
      </div>

      <label className="block">
        <span className="text-sm font-medium text-ink">{pick(T.typeEmail, locale)}</span>
        <input
          type="email"
          autoComplete="off"
          spellCheck={false}
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value);
            if (phase === "error") setPhase("idle");
          }}
          placeholder={email ?? ""}
          disabled={phase === "deleting"}
          className="mt-1.5 block h-10 w-full max-w-md rounded-lg border border-line bg-canvas px-3 text-sm text-ink placeholder:text-subtle focus:border-danger focus:outline-none"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error.text}
          {error.withEmail && (
            <>
              {" "}
              <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="font-medium underline underline-offset-2">
                {LEGAL_CONTACT_EMAIL}
              </a>
              .
            </>
          )}
        </p>
      )}

      <button
        type="button"
        onClick={onDelete}
        disabled={!matches || phase === "deleting"}
        className="inline-flex h-10 items-center rounded-lg bg-danger px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {phase === "deleting" ? pick(T.deleting, locale) : pick(T.button, locale)}
      </button>
    </div>
  );
}
