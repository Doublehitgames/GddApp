"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { getDriveImageDisplayCandidates } from "@/lib/googleDrivePicker";
import { ProjectViewTabs, type ProjectView } from "./ProjectViewTabs";

/** Altura total da barra, em px. Quem posiciona conteudo por baixo dela usa este numero. */
export const ALTURA_BARRA = 80;

interface Props {
  /** Icone da tela, ja colorido. Vira link pra home — e o unico caminho de volta. */
  icone: React.ReactNode;
  /** Icone do proprio projeto (o da Ficha Tecnica). Abre a barra, antes do icone
   *  da tela: primeiro QUAL jogo, depois qual modo dele voce esta olhando. */
  iconeProjetoUrl?: string;
  /** Nome da tela: "Game Design Map", "Game Design Document", o nome do projeto,
   *  ou a trilha de secoes quando voce esta dentro de uma. */
  titulo: React.ReactNode;
  projectSlug: string;
  active: ProjectView | null;
  publicToken?: string;
  /** Selo de compartilhamento. Fica depois das abas, na linha de baixo. */
  badge?: React.ReactNode;
  /** Busca da tela. Cada uma traz a sua — elas nao sao a mesma coisa. */
  busca?: React.ReactNode;
  /** Botoes de acao da tela (exportar, configuracoes, atalhos...). */
  acoes?: React.ReactNode;
  theme?: "light" | "dark";
  /** `fixed` no shell, `sticky` no documento, que rola dentro do fluxo. */
  posicao?: "fixed" | "sticky";
  /** Largura da faixa de conteudo. O documento e mais estreito que o mapa. */
  larguraConteudo?: string;
}

/**
 * A barra do projeto, em duas linhas: em cima quem voce esta olhando, embaixo
 * por qual modo. E uma peca so, montada em tres lugares diferentes — o shell, o
 * documento e o mapa publico — porque cada uma dessas telas desenhava a propria
 * barra antes e elas iam divergindo.
 *
 * O que NAO se compartilha e a busca: a do mapa move a camera, a do documento
 * rola ate a ancora. Cada tela passa a sua pelo slot `busca`.
 */
export function ProjectTopBar({
  icone,
  iconeProjetoUrl,
  titulo,
  projectSlug,
  active,
  publicToken,
  badge,
  busca,
  acoes,
  theme = "light",
  posicao = "fixed",
  larguraConteudo = "max-w-[1600px]",
}: Props) {
  const { t } = useI18n();
  const isDark = theme === "dark";
  const isPublic = Boolean(publicToken);

  const moldura = isDark
    ? "border-gray-700/60 bg-gray-900/92 shadow-lg shadow-black/20"
    : "border-gray-200 bg-white/90 shadow-sm";
  const corTitulo = isDark ? "text-gray-100" : "text-gray-900";

  return (
    <header
      className={`print:hidden ${
        posicao === "fixed" ? "fixed inset-x-0 top-0 z-40" : "sticky top-0 z-30"
      } border-b backdrop-blur-md ${moldura}`}
      style={{ height: ALTURA_BARRA }}
    >
      <div className={"mx-auto flex h-full w-full items-center gap-3 px-4 md:px-6 lg:px-8 " + larguraConteudo}>
        {/* O icone do projeto fica fora da coluna das duas linhas: ele vale pela
            barra inteira, e nao so pela linha do titulo. */}
        <IconeDoProjeto url={iconeProjetoUrl} />

        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div className="flex h-11 items-center gap-3">
            <span className="flex min-w-0 items-center gap-2">
              {isPublic ? (
                <span className="shrink-0 text-[#ef5f56]">{icone}</span>
              ) : (
                <Link
                  href="/"
                  className="shrink-0 text-[#ef5f56] transition-opacity hover:opacity-70"
                  title={t("projectDetail.backHome")}
                  aria-label={t("projectDetail.backHome")}
                >
                  {icone}
                </Link>
              )}
              <span className={corTitulo + " min-w-0 truncate text-base font-bold tracking-tight"}>{titulo}</span>
            </span>

            <div className="flex-1" />

            {busca}
            {acoes}
          </div>

          <div className="flex h-9 items-center gap-2">
            <ProjectViewTabs
              projectSlug={projectSlug}
              active={active}
              publicToken={publicToken}
              theme={theme}
            />
            {badge}
          </div>
        </div>
      </div>
    </header>
  );
}

/**
 * A miniatura do projeto na barra. O Drive serve a mesma imagem por varias URLs
 * e nem todas passam em todo navegador, entao a gente desce a lista de
 * candidatas a cada erro e, quando elas acabam, o icone some — melhor sem ele
 * do que com um quadradinho quebrado na barra.
 */
function IconeDoProjeto({ url }: { url?: string }) {
  const candidatas = useMemo(() => getDriveImageDisplayCandidates(url || ""), [url]);
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    setIndice(0);
  }, [url]);

  if (!url || indice >= candidatas.length) return null;

  return (
    <img
      src={candidatas[indice]}
      alt=""
      aria-hidden="true"
      className="h-16 w-16 shrink-0 rounded-xl object-cover"
      onError={() => setIndice((i) => i + 1)}
    />
  );
}

/** Cerebro — o mapa. Contorno, dois lobos, como na referencia. */
export function IconeMapa({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <path d="M6 18a4 4 0 0 1-1.967-.516M19.967 17.484A4 4 0 0 1 18 18" />
    </svg>
  );
}

/** Folha escrita — o documento. */
export function IconeDocumento({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 3.5h6.2a1 1 0 0 1 .7.3l4.3 4.3a1 1 0 0 1 .3.7V19a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 19V5A1.5 1.5 0 0 1 8 3.5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 3.7V8a1 1 0 0 0 1 1h4.3M9.5 12.5h7M9.5 16h4.5" />
    </svg>
  );
}

/** Blocos empilhados — a arvore de paginas do editor. */
export function IconeEditor({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6.5h5v5h-5zM4.5 15h5v3.5h-5zM13 6.5h6.5M13 10h6.5M13 15h6.5M13 18.5h4" />
    </svg>
  );
}
