"use client";

import { CoverImage } from "@/components/project/ProjectCover";
import { DomainIcon, domainVisual } from "@/components/project/domainVisual";
import { isValidDomainId } from "@/lib/gameDesignDomains";

/** O mínimo que se precisa de uma página para desenhar a cara dela. */
export type ThumbSection = {
  title?: string | null;
  thumbImageUrl?: string | null;
  domainTags?: string[] | null;
};

/** A categoria de uma página é o primeiro domínio de game design dela. */
export function sectionDomain(section?: ThumbSection | null): string {
  return section?.domainTags?.find(isValidDomainId) ?? "other";
}

/**
 * A cara de uma página: a thumb que ela escolheu na biblioteca e, sem thumb (ou
 * se a imagem não carregar), o ícone do domínio.
 *
 * Mora aqui porque é a mesma imagem em toda superfície que mostra uma página
 * sem abrir ela — a carta de filha, a linha da lista, o modal de prévia. Quando
 * cada tela desenhava a sua, umas mostravam a imagem e outras não.
 */
export function SectionThumb({
  section,
  className = "h-10 w-10",
  iconClassName = "h-5 w-5",
}: {
  section?: ThumbSection | null;
  className?: string;
  iconClassName?: string;
}) {
  const domain = sectionDomain(section);
  const icon = (
    <span className={`absolute inset-0 grid place-items-center ${domainVisual(domain).tile}`}>
      <DomainIcon id={domain} className={iconClassName} />
    </span>
  );
  return (
    <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-2 ${className}`}>
      {section?.thumbImageUrl ? (
        <CoverImage src={section.thumbImageUrl} alt={section.title ?? ""} fallback={icon} />
      ) : (
        icon
      )}
    </span>
  );
}
