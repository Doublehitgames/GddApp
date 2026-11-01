"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { LegalCallout, LegalHeader, LegalSection } from "@/components/legal/LegalArticle";
import { useI18n } from "@/lib/i18n/provider";
import type { AppLocale } from "@/lib/i18n/config";
import { LEGAL_CONTACT_EMAIL, legalHref, pick } from "@/lib/legal/pages";
import { useAuthStore } from "@/store/authStore";
import { useProjectStore } from "@/store/projectStore";
import type { Project } from "@/store/slices/types";
import { THEME_STORAGE_KEY } from "@/lib/theme/config";
import { buildAccountExport, buildFullBackup, projectRole, toJsonBlob } from "@/lib/dataExport/json";
import { buildMarkdownArchiveFiles, type MarkdownLabels } from "@/lib/dataExport/markdown";
import { buildZip, downloadBlob } from "@/lib/dataExport/zip";
import { exportDateStamp, safeFileName, uniqueNamer } from "@/lib/dataExport/fileNames";

/**
 * Exportar os dados (portabilidade, LGPD art. 18 V): baixar tudo o que é da
 * pessoa, sem pedir a ninguém, de graça e quantas vezes quiser.
 *
 * Tudo roda no navegador, a partir do que a store já tem carregado (local +
 * o que veio da nuvem no login). Nada aqui chama o Supabase nem gasta crédito.
 *
 * - JSON: o mesmo formato do /backup — é o único restaurável. Não mudar a
 *   forma sem mudar a restauração (lib/dataExport/json.ts).
 * - Markdown: zip com uma pasta por projeto e um .md por página
 *   (lib/dataExport/markdown.ts).
 * - Word: um .docx por projeto (lib/dataExport/docx.ts).
 * - Conta: e-mail, nome, datas e preferências; nunca token nem sessão.
 */

type FormatId = "json" | "markdown" | "word" | "account";

type Copy = {
  summaryLabel: string;
  summary: string;
  whatTitle: string;
  whatLead: string;
  whatItems: ReactNode[];
  whereTitle: string;
  where: ReactNode;
  downloadTitle: string;
  downloadLead: string;
  loading: string;
  emptyTitle: string;
  empty: ReactNode;
  signIn: string;
  mine: string;
  shared: string;
  local: string;
  sharedHint: string;
  pages: (n: number) => string;
  selectAll: string;
  selectNone: string;
  selected: (n: number, total: number) => string;
  cloudNote: string;
  formats: Record<FormatId, { title: string; badge: string; body: string; when: string; button: string }>;
  noSelection: string;
  working: string;
  step: (i: number, n: number, title: string) => string;
  done: (file: string) => string;
  error: string;
  mdLabels: MarkdownLabels;
  restoreTitle: string;
  restore: ReactNode;
  outTitle: string;
  outItems: ReactNode[];
  pdfTitle: string;
  pdf: ReactNode;
  freeTitle: string;
  free: ReactNode;
  contactTitle: string;
  contact: ReactNode;
};

const mail = <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>;

const COPY: Record<AppLocale, Copy> = {
  "pt-BR": {
    summaryLabel: "Em uma frase",
    summary: "Tudo o que você escreveu no GDD é seu, e você pode levar embora quando quiser — de graça, sem limite e sem pedir a ninguém.",
    whatTitle: "O que são os seus dados",
    whatLead: "Quando a gente fala em \"seus dados\", é tudo isto:",
    whatItems: [
      <><strong>Projetos</strong>: título, capa, descrição e a Visão do jogo (frase de efeito, pilares, gênero).</>,
      <><strong>Páginas</strong>: a árvore inteira, na ordem em que você deixou, com título, ícone, cor, tags, estado (rascunho, aprovado…) e o ID de dados.</>,
      <><strong>Descrições</strong>: o texto de cada página, com as tabelas de balanceamento, listas, avisos e as referências entre páginas.</>,
      <><strong>Fluxogramas</strong> de cada página e a <strong>regra de tabelas</strong> das coleções da Biblioteca.</>,
      <><strong>Ajustes do projeto</strong>: o visual do mapa mental, as instruções para a IA, o tema do modo documento.</>,
      <><strong>Sua conta</strong>: e-mail, nome, foto e quando você entrou.</>,
    ],
    whereTitle: "Onde eles moram",
    where: (
      <>
        <p>Todo projeto mora <strong>neste navegador</strong>, mesmo sem login. Se você entrou na sua conta, os projetos sincronizados também têm uma cópia <strong>na nuvem</strong>, e é ela que aparece quando você abre o GDD em outro computador.</p>
        <p>O download abaixo junta as duas coisas: o que está aqui e o que veio da nuvem quando você entrou. Ele é montado no seu próprio navegador — nada passa por outro lugar.</p>
      </>
    ),
    downloadTitle: "Baixar",
    downloadLead: "Escolha os projetos e o formato. Pode baixar quantas vezes quiser.",
    loading: "Carregando os seus projetos…",
    emptyTitle: "Não achamos nenhum projeto aqui",
    empty: (
      <p>Este navegador não tem projeto guardado e você não está com a conta aberta. Se você usa o GDD com login, entre para que os seus projetos da nuvem apareçam aqui.</p>
    ),
    signIn: "Entrar e voltar para cá",
    mine: "Seus projetos",
    shared: "Compartilhados com você",
    local: "Neste navegador",
    sharedHint: "Você é membro destes projetos. Eles são do dono, mas você pode levar uma cópia do que tem acesso.",
    pages: (n) => (n === 1 ? "1 página" : `${n} páginas`),
    selectAll: "Marcar todos",
    selectNone: "Desmarcar todos",
    selected: (n, total) => `${n} de ${total} marcados`,
    cloudNote: "Acabou de entrar e falta algum projeto que você tem em outro computador? Espere alguns segundos: a cópia da nuvem ainda está chegando.",
    formats: {
      json: {
        title: "Backup completo",
        badge: "JSON · restaurável",
        body: "Tudo, sem perder nada: páginas, ordem, fluxogramas, tabelas, ajustes.",
        when: "Use para guardar uma cópia de segurança ou mudar de computador. É o único formato que volta para o GDD.",
        button: "Baixar backup",
      },
      markdown: {
        title: "Markdown",
        badge: ".zip · uma pasta por projeto",
        body: "Um arquivo de texto por página, com as subpáginas em pastas. As referências viram links entre os arquivos e o fluxograma vai em Mermaid.",
        when: "Use para abrir no Obsidian, Notion, GitHub ou qualquer editor de texto.",
        button: "Baixar Markdown",
      },
      word: {
        title: "Word",
        badge: ".docx · um por projeto",
        body: "O GDD inteiro num documento, com títulos, listas e tabelas.",
        when: "Use para ler, imprimir ou mandar para quem não usa o GDD.",
        button: "Baixar Word",
      },
      account: {
        title: "Dados da conta",
        badge: "JSON",
        body: "Seu e-mail, nome, foto, quando a conta foi criada, como você entra e a lista dos seus projetos.",
        when: "Use para saber o que o GDD guarda sobre você.",
        button: "Baixar dados da conta",
      },
    },
    noSelection: "Marque pelo menos um projeto.",
    working: "Preparando…",
    step: (i, n, title) => `Preparando ${i} de ${n}: ${title}`,
    done: (file) => `Pronto: ${file}`,
    error: "Não deu certo montar o arquivo. Tente de novo; se continuar, escreva para a gente.",
    mdLabels: {
      vision: "Visão do jogo",
      logline: "Em uma frase",
      playerVerb: "O que o jogador faz",
      feeling: "O que o jogador sente",
      pillars: "Pilares",
      genre: "Gênero",
      pages: "Páginas",
      flowchart: "Fluxograma",
      emptyPage: "(página sem descrição)",
    },
    restoreTitle: "Como restaurar",
    restore: (
      <p>Abra <Link href="/backup">Backup e restauração</Link>, clique em escolher arquivo e aponte para o backup em JSON. O GDD pergunta antes de substituir o que já existe. Markdown e Word são para ler e levar para outro lugar — eles não voltam para o GDD.</p>
    ),
    outTitle: "O que não vai no arquivo",
    outItems: [
      <><strong>As imagens em si.</strong> Ícones e capas que vêm do seu Google Drive ou de um link continuam lá; o arquivo leva o endereço delas.</>,
      <><strong>O que é do projeto e não seu</strong>: a lista de membros, o histórico de quem mexeu e o &quot;O que mudou&quot;.</>,
      <><strong>Chaves de API e conexões</strong> com o Claude e outros programas. Por segurança, elas não saem daqui — dá para criar outras quando quiser.</>,
      <><strong>Senha e login</strong>. Nunca vão em arquivo nenhum.</>,
    ],
    pdfTitle: "E PDF?",
    pdf: (
      <p>O PDF mais bonito sai do <strong>modo documento</strong>: abra o projeto, escolha &quot;Ver como Documento&quot; e mande imprimir como PDF. Ele mantém as cores, as imagens e os emojis, coisa que um PDF montado aqui perderia.</p>
    ),
    freeTitle: "De graça e sem limite",
    free: <p>Exportar não gasta crédito de sincronização, não depende de plano e não tem limite de vezes. Se um dia o GDD fechar, este botão é a garantia de que nada fica preso — veja também <Link href={legalHref("garantias")}>Garantias e continuidade</Link>.</p>,
    contactTitle: "Dúvidas",
    contact: <p>Faltou alguma coisa no arquivo ou algo não abriu? Escreva para {mail}.</p>,
  },
  en: {
    summaryLabel: "In one sentence",
    summary: "Everything you wrote in GDD is yours, and you can take it with you whenever you want — free, unlimited, no need to ask anyone.",
    whatTitle: "What your data is",
    whatLead: "When we say \"your data\", we mean all of this:",
    whatItems: [
      <><strong>Projects</strong>: title, cover, description and the game Vision (logline, pillars, genre).</>,
      <><strong>Pages</strong>: the whole tree, in the order you left it, with title, icon, color, tags, status (draft, approved…) and data ID.</>,
      <><strong>Descriptions</strong>: the text of every page, with balance tables, lists, callouts and the links between pages.</>,
      <>Each page&apos;s <strong>flowchart</strong> and the <strong>table rule</strong> of your Library collections.</>,
      <><strong>Project settings</strong>: the mind map look, the AI instructions, the document mode theme.</>,
      <><strong>Your account</strong>: email, name, photo and when you joined.</>,
    ],
    whereTitle: "Where it lives",
    where: (
      <>
        <p>Every project lives <strong>in this browser</strong>, even without signing in. If you are signed in, synced projects also have a copy <strong>in the cloud</strong> — that is what shows up when you open GDD on another computer.</p>
        <p>The download below combines both: what is here and what came from the cloud when you signed in. It is put together in your own browser — nothing goes anywhere else.</p>
      </>
    ),
    downloadTitle: "Download",
    downloadLead: "Pick the projects and the format. Download as many times as you like.",
    loading: "Loading your projects…",
    emptyTitle: "We found no projects here",
    empty: <p>This browser has no saved projects and you are not signed in. If you use GDD with an account, sign in so your cloud projects show up here.</p>,
    signIn: "Sign in and come back here",
    mine: "Your projects",
    shared: "Shared with you",
    local: "In this browser",
    sharedHint: "You are a member of these projects. They belong to their owner, but you can take a copy of what you can access.",
    pages: (n) => (n === 1 ? "1 page" : `${n} pages`),
    selectAll: "Select all",
    selectNone: "Clear all",
    selected: (n, total) => `${n} of ${total} selected`,
    cloudNote: "Just signed in and a project from another computer is missing? Wait a few seconds: the cloud copy is still arriving.",
    formats: {
      json: {
        title: "Full backup",
        badge: "JSON · restorable",
        body: "Everything, nothing lost: pages, order, flowcharts, tables, settings.",
        when: "Use it to keep a safety copy or move to another computer. It is the only format that goes back into GDD.",
        button: "Download backup",
      },
      markdown: {
        title: "Markdown",
        badge: ".zip · one folder per project",
        body: "One text file per page, with sub-pages in folders. References become links between files and flowcharts go in Mermaid.",
        when: "Use it to open in Obsidian, Notion, GitHub or any text editor.",
        button: "Download Markdown",
      },
      word: {
        title: "Word",
        badge: ".docx · one per project",
        body: "The whole GDD in one document, with headings, lists and tables.",
        when: "Use it to read, print or send to someone who doesn't use GDD.",
        button: "Download Word",
      },
      account: {
        title: "Account data",
        badge: "JSON",
        body: "Your email, name, photo, when the account was created, how you sign in and the list of your projects.",
        when: "Use it to see what GDD keeps about you.",
        button: "Download account data",
      },
    },
    noSelection: "Select at least one project.",
    working: "Preparing…",
    step: (i, n, title) => `Preparing ${i} of ${n}: ${title}`,
    done: (file) => `Done: ${file}`,
    error: "We couldn't build the file. Try again; if it keeps failing, write to us.",
    mdLabels: {
      vision: "Game vision",
      logline: "In one sentence",
      playerVerb: "What the player does",
      feeling: "What the player feels",
      pillars: "Pillars",
      genre: "Genre",
      pages: "Pages",
      flowchart: "Flowchart",
      emptyPage: "(page without description)",
    },
    restoreTitle: "How to restore",
    restore: <p>Open <Link href="/backup">Backup and restore</Link>, choose a file and point to the JSON backup. GDD asks before replacing what already exists. Markdown and Word are for reading and taking elsewhere — they don&apos;t go back into GDD.</p>,
    outTitle: "What is not in the file",
    outItems: [
      <><strong>The images themselves.</strong> Icons and covers from your Google Drive or a link stay there; the file keeps their address.</>,
      <><strong>What belongs to the project, not to you</strong>: the member list, the history of who changed what, and &quot;What changed&quot;.</>,
      <><strong>API keys and connections</strong> to Claude and other tools. For safety they never leave — you can create new ones any time.</>,
      <><strong>Password and sign-in</strong>. Never in any file.</>,
    ],
    pdfTitle: "What about PDF?",
    pdf: <p>The nicest PDF comes from <strong>document mode</strong>: open the project, choose &quot;View as Document&quot; and print to PDF. It keeps colors, images and emoji, which a PDF built here would lose.</p>,
    freeTitle: "Free and unlimited",
    free: <p>Exporting uses no sync credits, does not depend on your plan and has no limit. If GDD ever shuts down, this button is the guarantee that nothing stays locked in — see also <Link href={legalHref("garantias")}>Guarantees and continuity</Link>.</p>,
    contactTitle: "Questions",
    contact: <p>Something missing from the file, or something won&apos;t open? Write to {mail}.</p>,
  },
  es: {
    summaryLabel: "En una frase",
    summary: "Todo lo que escribiste en GDD es tuyo, y puedes llevártelo cuando quieras — gratis, sin límite y sin pedírselo a nadie.",
    whatTitle: "Qué son tus datos",
    whatLead: "Cuando hablamos de \"tus datos\", es todo esto:",
    whatItems: [
      <><strong>Proyectos</strong>: título, portada, descripción y la Visión del juego (frase, pilares, género).</>,
      <><strong>Páginas</strong>: el árbol completo, en el orden que dejaste, con título, icono, color, etiquetas, estado (borrador, aprobado…) y el ID de datos.</>,
      <><strong>Descripciones</strong>: el texto de cada página, con las tablas de balance, listas, avisos y las referencias entre páginas.</>,
      <>El <strong>diagrama de flujo</strong> de cada página y la <strong>regla de tablas</strong> de las colecciones de la Biblioteca.</>,
      <><strong>Ajustes del proyecto</strong>: el aspecto del mapa mental, las instrucciones para la IA, el tema del modo documento.</>,
      <><strong>Tu cuenta</strong>: correo, nombre, foto y cuándo te uniste.</>,
    ],
    whereTitle: "Dónde viven",
    where: (
      <>
        <p>Todo proyecto vive <strong>en este navegador</strong>, incluso sin iniciar sesión. Si entraste con tu cuenta, los proyectos sincronizados también tienen una copia <strong>en la nube</strong>, que es la que aparece cuando abres GDD en otra computadora.</p>
        <p>La descarga de abajo junta las dos cosas: lo que está aquí y lo que llegó de la nube al entrar. Se arma en tu propio navegador — nada pasa por otro lugar.</p>
      </>
    ),
    downloadTitle: "Descargar",
    downloadLead: "Elige los proyectos y el formato. Puedes descargar cuantas veces quieras.",
    loading: "Cargando tus proyectos…",
    emptyTitle: "No encontramos ningún proyecto aquí",
    empty: <p>Este navegador no tiene proyectos guardados y no has iniciado sesión. Si usas GDD con cuenta, entra para que tus proyectos de la nube aparezcan aquí.</p>,
    signIn: "Entrar y volver aquí",
    mine: "Tus proyectos",
    shared: "Compartidos contigo",
    local: "En este navegador",
    sharedHint: "Eres miembro de estos proyectos. Son de su dueño, pero puedes llevarte una copia de lo que tienes acceso.",
    pages: (n) => (n === 1 ? "1 página" : `${n} páginas`),
    selectAll: "Marcar todos",
    selectNone: "Desmarcar todos",
    selected: (n, total) => `${n} de ${total} marcados`,
    cloudNote: "¿Acabas de entrar y falta un proyecto que tienes en otra computadora? Espera unos segundos: la copia de la nube todavía está llegando.",
    formats: {
      json: {
        title: "Backup completo",
        badge: "JSON · restaurable",
        body: "Todo, sin perder nada: páginas, orden, diagramas, tablas, ajustes.",
        when: "Úsalo para guardar una copia de seguridad o cambiar de computadora. Es el único formato que vuelve a GDD.",
        button: "Descargar backup",
      },
      markdown: {
        title: "Markdown",
        badge: ".zip · una carpeta por proyecto",
        body: "Un archivo de texto por página, con las subpáginas en carpetas. Las referencias se vuelven enlaces entre archivos y el diagrama va en Mermaid.",
        when: "Úsalo para abrir en Obsidian, Notion, GitHub o cualquier editor de texto.",
        button: "Descargar Markdown",
      },
      word: {
        title: "Word",
        badge: ".docx · uno por proyecto",
        body: "El GDD entero en un documento, con títulos, listas y tablas.",
        when: "Úsalo para leer, imprimir o enviar a quien no usa GDD.",
        button: "Descargar Word",
      },
      account: {
        title: "Datos de la cuenta",
        badge: "JSON",
        body: "Tu correo, nombre, foto, cuándo se creó la cuenta, cómo entras y la lista de tus proyectos.",
        when: "Úsalo para saber qué guarda GDD sobre ti.",
        button: "Descargar datos de la cuenta",
      },
    },
    noSelection: "Marca al menos un proyecto.",
    working: "Preparando…",
    step: (i, n, title) => `Preparando ${i} de ${n}: ${title}`,
    done: (file) => `Listo: ${file}`,
    error: "No pudimos armar el archivo. Inténtalo de nuevo; si sigue fallando, escríbenos.",
    mdLabels: {
      vision: "Visión del juego",
      logline: "En una frase",
      playerVerb: "Qué hace el jugador",
      feeling: "Qué siente el jugador",
      pillars: "Pilares",
      genre: "Género",
      pages: "Páginas",
      flowchart: "Diagrama de flujo",
      emptyPage: "(página sin descripción)",
    },
    restoreTitle: "Cómo restaurar",
    restore: <p>Abre <Link href="/backup">Backup y restauración</Link>, elige un archivo y apunta al backup en JSON. GDD pregunta antes de reemplazar lo que ya existe. Markdown y Word son para leer y llevar a otro lugar — no vuelven a GDD.</p>,
    outTitle: "Qué no va en el archivo",
    outItems: [
      <><strong>Las imágenes en sí.</strong> Iconos y portadas de tu Google Drive o de un enlace siguen allí; el archivo guarda su dirección.</>,
      <><strong>Lo que es del proyecto y no tuyo</strong>: la lista de miembros, el historial de quién cambió qué y &quot;Qué cambió&quot;.</>,
      <><strong>Claves de API y conexiones</strong> con Claude y otros programas. Por seguridad no salen de aquí — puedes crear otras cuando quieras.</>,
      <><strong>Contraseña e inicio de sesión</strong>. Nunca van en ningún archivo.</>,
    ],
    pdfTitle: "¿Y PDF?",
    pdf: <p>El PDF más bonito sale del <strong>modo documento</strong>: abre el proyecto, elige &quot;Ver como documento&quot; e imprime como PDF. Mantiene colores, imágenes y emojis, algo que un PDF armado aquí perdería.</p>,
    freeTitle: "Gratis y sin límite",
    free: <p>Exportar no gasta créditos de sincronización, no depende del plan y no tiene límite de veces. Si algún día GDD cierra, este botón es la garantía de que nada queda atrapado — mira también <Link href={legalHref("garantias")}>Garantías y continuidad</Link>.</p>,
    contactTitle: "Dudas",
    contact: <p>¿Falta algo en el archivo o algo no abre? Escribe a {mail}.</p>,
  },
};

type Status = { kind: "idle" } | { kind: "working"; format: FormatId; text: string } | { kind: "done"; text: string } | { kind: "error"; text: string };

function readTheme(): string | null {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function ExportarClient() {
  const { locale } = useI18n();
  const c = pick(COPY, locale);

  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const authLoading = useAuthStore((s) => s.loading);
  const projects = useProjectStore((s) => s.projects);

  const userId = user?.id ?? null;
  const groups = useMemo(() => {
    const mine: Project[] = [];
    const shared: Project[] = [];
    for (const p of projects) (projectRole(p, userId) === "member" ? shared : mine).push(p);
    const byTitle = (a: Project, b: Project) => (a.title || "").localeCompare(b.title || "", locale);
    return { mine: mine.sort(byTitle), shared: shared.sort(byTitle) };
  }, [projects, userId, locale]);

  // Marcado por padrão: guardamos só o que a pessoa DESmarcou, assim projeto
  // que chega da nuvem depois de a página abrir já entra marcado.
  const [unchecked, setUnchecked] = useState<Set<string>>(() => new Set());
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const selected = useMemo(() => projects.filter((p) => !unchecked.has(p.id)), [projects, unchecked]);

  // Mensagem de "pronto" some sozinha; erro fica até a próxima tentativa.
  useEffect(() => {
    if (status.kind !== "done") return;
    const id = window.setTimeout(() => setStatus({ kind: "idle" }), 6000);
    return () => window.clearTimeout(id);
  }, [status]);

  const toggle = (id: string) =>
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const busy = status.kind === "working";
  const stamp = exportDateStamp();

  const run = async (format: FormatId) => {
    if (busy) return;
    if (format !== "account" && selected.length === 0) {
      setStatus({ kind: "error", text: c.noSelection });
      return;
    }
    setStatus({ kind: "working", format, text: c.working });
    // Deixa o React pintar o "Preparando…" antes do trabalho pesado.
    await new Promise((r) => setTimeout(r, 0));
    try {
      let file = "";
      if (format === "json") {
        file = `gdd-backup-${stamp}.json`;
        downloadBlob(toJsonBlob(buildFullBackup(selected)), file);
      } else if (format === "markdown") {
        file = `gdd-markdown-${stamp}.zip`;
        const blob = await buildZip(buildMarkdownArchiveFiles(selected, c.mdLabels));
        downloadBlob(blob, file);
      } else if (format === "word") {
        const { buildProjectDocx } = await import("@/lib/dataExport/docx");
        const namer = uniqueNamer();
        const entries: { path: string; content: Blob }[] = [];
        for (let i = 0; i < selected.length; i += 1) {
          const p = selected[i];
          setStatus({ kind: "working", format, text: c.step(i + 1, selected.length, p.title || "—") });
          entries.push({ path: `${namer(safeFileName(p.title, "projeto"))}.docx`, content: await buildProjectDocx(p, c.mdLabels) });
        }
        if (entries.length === 1) {
          file = entries[0].path;
          downloadBlob(entries[0].content, file);
        } else {
          file = `gdd-word-${stamp}.zip`;
          downloadBlob(await buildZip(entries), file);
        }
      } else {
        file = `gdd-conta-${stamp}.json`;
        const data = buildAccountExport({ user, profile, locale, theme: readTheme(), projects });
        downloadBlob(toJsonBlob(data), file);
      }
      setStatus({ kind: "done", text: c.done(file) });
    } catch (error) {
      console.error("[exportar]", error);
      setStatus({ kind: "error", text: c.error });
    }
  };

  const hasProjects = projects.length > 0;
  const showEmpty = !authLoading && !user && !hasProjects;

  return (
    <>
      <LegalHeader slug="exportar" />

      <LegalCallout>
        <strong>{c.summaryLabel}:</strong> {c.summary}
      </LegalCallout>

      <LegalSection title={c.whatTitle}>
        <p>{c.whatLead}</p>
        <ul>
          {c.whatItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection title={c.whereTitle}>{c.where}</LegalSection>

      <section className="mb-8" aria-labelledby="exportar-baixar">
        <h2 id="exportar-baixar" className="mb-1 text-xl font-semibold tracking-tight text-ink">
          {c.downloadTitle}
        </h2>
        <p className="mb-4 text-[15px] text-muted">{c.downloadLead}</p>

        {authLoading && !hasProjects ? (
          <div className="rounded-2xl border border-line bg-surface p-6 text-sm text-muted">{c.loading}</div>
        ) : showEmpty ? (
          <div className="rounded-2xl border border-line bg-surface p-6 text-[15px] leading-relaxed">
            <h3 className="mb-2 text-base font-semibold text-ink">{c.emptyTitle}</h3>
            <div className="text-muted">{c.empty}</div>
            <Link
              href={`/login?next=${encodeURIComponent(legalHref("exportar"))}`}
              className="mt-4 inline-flex h-10 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent hover:opacity-90"
            >
              {c.signIn}
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <ProjectPicker
              c={c}
              groups={groups}
              signedIn={Boolean(user)}
              unchecked={unchecked}
              onToggle={toggle}
              onAll={() => setUnchecked(new Set())}
              onNone={() => setUnchecked(new Set(projects.map((p) => p.id)))}
              selectedCount={selected.length}
              total={projects.length}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              {(["json", "markdown", "word", "account"] as FormatId[])
                .filter((f) => f !== "account" || user)
                .map((f) => {
                  const fmt = c.formats[f];
                  const disabled = busy || (f !== "account" && selected.length === 0);
                  const working = status.kind === "working" && status.format === f;
                  return (
                    <article key={f} className="flex flex-col rounded-2xl border border-line bg-surface p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-ink">{fmt.title}</h3>
                        <span className="rounded-full bg-area-lib-soft px-2 py-0.5 text-[11px] font-semibold text-area-lib">{fmt.badge}</span>
                      </div>
                      <p className="mt-2 text-sm text-ink">{fmt.body}</p>
                      <p className="mt-1 flex-1 text-sm text-muted">{fmt.when}</p>
                      <button
                        type="button"
                        onClick={() => void run(f)}
                        disabled={disabled}
                        aria-busy={working}
                        className={`mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${
                          f === "json" ? "bg-area-lib text-white" : "bg-accent-soft text-accent"
                        }`}
                      >
                        <DownloadIcon />
                        {working ? c.working : fmt.button}
                      </button>
                    </article>
                  );
                })}
            </div>

            <div aria-live="polite" className="min-h-[1.5rem]">
              {status.kind === "working" && <p className="text-sm text-muted">{status.text}</p>}
              {status.kind === "done" && <p className="text-sm font-medium text-ink">{status.text}</p>}
              {status.kind === "error" && (
                <p role="alert" className="rounded-xl border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-ink">
                  {status.text}
                </p>
              )}
            </div>

            {user && <p className="text-xs text-subtle">{c.cloudNote}</p>}
          </div>
        )}
      </section>

      <LegalSection title={c.restoreTitle}>{c.restore}</LegalSection>

      <LegalSection title={c.outTitle}>
        <ul>
          {c.outItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection title={c.pdfTitle}>{c.pdf}</LegalSection>
      <LegalSection title={c.freeTitle}>{c.free}</LegalSection>
      <LegalSection title={c.contactTitle}>{c.contact}</LegalSection>
    </>
  );
}

function ProjectPicker({
  c,
  groups,
  signedIn,
  unchecked,
  onToggle,
  onAll,
  onNone,
  selectedCount,
  total,
}: {
  c: Copy;
  groups: { mine: Project[]; shared: Project[] };
  signedIn: boolean;
  unchecked: Set<string>;
  onToggle: (id: string) => void;
  onAll: () => void;
  onNone: () => void;
  selectedCount: number;
  total: number;
}) {
  const renderGroup = (title: string, list: Project[], hint?: string) =>
    list.length === 0 ? null : (
      <fieldset className="min-w-0">
        <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-subtle">{title}</legend>
        {hint && <p className="mb-2 text-xs text-muted">{hint}</p>}
        <ul className="divide-y divide-line">
          {list.map((p) => {
            const checked = !unchecked.has(p.id);
            return (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-3 py-2">
                  <input type="checkbox" checked={checked} onChange={() => onToggle(p.id)} className="h-4 w-4 shrink-0 accent-[var(--area-lib)]" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{p.title || "—"}</span>
                  <span className="shrink-0 text-xs text-muted">{c.pages(p.sections?.length ?? 0)}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
    );

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">{c.selected(selectedCount, total)}</span>
        <span className="ml-auto flex gap-1">
          <button type="button" onClick={onAll} className="rounded-lg px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent-soft">
            {c.selectAll}
          </button>
          <button type="button" onClick={onNone} className="rounded-lg px-2.5 py-1 text-xs font-semibold text-muted hover:bg-surface-2">
            {c.selectNone}
          </button>
        </span>
      </div>
      <div className="space-y-4">
        {renderGroup(signedIn ? c.mine : c.local, groups.mine)}
        {renderGroup(c.shared, groups.shared, c.sharedHint)}
      </div>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" />
    </svg>
  );
}
