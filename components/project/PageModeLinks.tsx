"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { sectionPathById } from "@/lib/utils/slug";
import { IconeDeck, IconeDocumento, IconeLapis, IconeMapa } from "@/components/project/ProjectTopBar";

/** Os modos que sabem receber uma página específica. */
export type PageMode = "editor" | "doc" | "deck" | "graph";

/** A ordem em que os modos aparecem, sempre a mesma em qualquer tela. */
const ORDEM: PageMode[] = ["doc", "deck", "graph", "editor"];

export const PAGE_MODE_META: Record<
  PageMode,
  { Icone: (props: { className?: string }) => React.ReactElement; chave: string; padrao: string }
> = {
  doc: { Icone: IconeDocumento, chave: "pageModes.doc", padrao: "Ver no Doc" },
  deck: { Icone: IconeDeck, chave: "pageModes.deck", padrao: "Ver no Deck" },
  graph: { Icone: IconeMapa, chave: "pageModes.graph", padrao: "Ver no mapa mental" },
  editor: { Icone: IconeLapis, chave: "pageModes.editor", padrao: "Editar a página" },
};

export interface PageModeTarget {
  /** Slug ou id usado nas rotas do projeto. */
  projectId: string;
  /** O projeto inteiro — só a rota do editor precisa dele, para montar o slug. */
  project?: unknown;
  sectionId: string;
  /** Presente = modo público: rotas por token, e sem editor. */
  publicToken?: string;
}

/** Para onde vai cada modo, levando a página junto. */
export function pageModeUrl(mode: PageMode, target: PageModeTarget): string {
  const foco = encodeURIComponent(target.sectionId);

  if (target.publicToken) {
    const token = encodeURIComponent(target.publicToken);
    const modo = mode === "graph" ? "mindmap" : mode === "deck" ? "deck" : "view";
    return `/s/${token}?mode=${modo}&focus=${foco}`;
  }

  if (mode === "editor") {
    return sectionPathById((target.project as never) ?? { title: "", sections: [] }, target.sectionId);
  }

  const rota = mode === "graph" ? "mindmap" : mode === "deck" ? "deck" : "view";
  return `/projects/${target.projectId}/${rota}?focus=${foco}`;
}

interface Props extends PageModeTarget {
  /** O modo em que a pessoa já está — ele não se oferece. */
  current: PageMode;
  className?: string;
  /** Aparência de cada botão. Função quando cada modo tem a sua. */
  buttonClassName?: string | ((mode: PageMode) => string);
  iconClassName?: string;
}

/**
 * Os modos que valem como destino a partir de onde você está.
 *
 * Exportada porque nem toda tela desenha esta navegação como a fileira de
 * ícones daqui — o DOC, por exemplo, tem um menu com texto. O que não pode é
 * cada tela ter a sua lista: foi assim que o Deck nasceu invisível lá.
 */
export function listPageModes(current: PageMode, publicToken?: string): PageMode[] {
  return ORDEM.filter((mode) => mode !== current).filter(
    (mode) => !(mode === "editor" && publicToken)
  );
}

const BOTAO_PADRAO =
  "grid h-[30px] w-[30px] place-items-center rounded-lg border border-transparent text-gray-400 transition-colors hover:border-gray-200 hover:bg-white hover:text-gray-900";

/**
 * "Ver esta página nos outros modos".
 *
 * Existe um lugar só porque a pergunta é a mesma em todos: estou olhando esta
 * página aqui, quero olhar ela ali. Cada tela mostra os outros três e esconde
 * o próprio — e um modo novo entra nesta lista, não em quatro telas.
 *
 * O editor não aparece no modo público: lá a página não abre para escrita.
 */
export default function PageModeLinks({
  current,
  projectId,
  project,
  sectionId,
  publicToken,
  className = "",
  buttonClassName,
  iconClassName = "h-[17px] w-[17px]",
}: Props) {
  const { t } = useI18n();
  const router = useRouter();

  const modos = listPageModes(current, publicToken);

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {modos.map((mode) => {
        const { Icone, chave, padrao } = PAGE_MODE_META[mode];
        const titulo = t(chave, padrao);
        const classe =
          typeof buttonClassName === "function"
            ? buttonClassName(mode)
            : buttonClassName || BOTAO_PADRAO;

        return (
          <button
            key={mode}
            type="button"
            title={titulo}
            aria-label={titulo}
            onClick={() => router.push(pageModeUrl(mode, { projectId, project, sectionId, publicToken }))}
            className={classe}
          >
            <Icone className={iconClassName} />
          </button>
        );
      })}
    </span>
  );
}
