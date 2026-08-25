"use client";

import { useState } from "react";
import { driveFileIdToImageCandidates } from "@/lib/googleDrivePicker";
import { useI18n } from "@/lib/i18n/provider";

interface DriveThumbProps {
  fileId: string;
  alt: string;
  /** Largura pedida ao Drive, em px. Use a largura real de exibição. */
  size?: number;
  className?: string;
}

/**
 * Imagem do Drive que não desiste na primeira falha.
 *
 * O mesmo arquivo pode falhar em um endpoint do Google e funcionar em outro, e
 * uma grade inteira pedindo imagem grande de uma vez faz o Drive estrangular.
 * Então: pede o tamanho real, tenta o CDN primeiro e desce a lista de candidatas
 * no `onError`. Se todas falharem, mostra um quadro com o nome do arquivo — quase
 * sempre é arquivo que não está compartilhado como "qualquer pessoa com o link",
 * e ver qual é vale mais do que um ícone de imagem quebrada.
 */
export function DriveThumb({ fileId, alt, size = 200, className }: DriveThumbProps) {
  const { t } = useI18n();
  const candidates = driveFileIdToImageCandidates(fileId, size);
  // O arquivo entra no estado junto com a tentativa: trocar de arquivo (grade
  // filtrada, índice atualizado) recomeça a cadeia sem precisar de efeito.
  const [tried, setTried] = useState({ fileId, attempt: 0 });
  const attempt = tried.fileId === fileId ? tried.attempt : 0;

  if (attempt >= candidates.length) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-950 p-1 text-center text-[8px] leading-tight text-gray-500 ${className ?? ""}`}
        title={t("imageLibrary.thumbNoAccessTooltip").replace("{name}", alt)}
      >
        {t("imageLibrary.thumbNoAccess")}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={candidates[attempt]}
      alt={alt}
      loading="lazy"
      decoding="async"
      // Sem referrer o lh3/Drive deixa de recusar por origem.
      referrerPolicy="no-referrer"
      onError={() => setTried({ fileId, attempt: attempt + 1 })}
      className={className}
    />
  );
}
