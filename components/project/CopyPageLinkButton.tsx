"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { pageShareUrl, type PageMode } from "@/components/project/PageModeLinks";

interface Props {
  /** O modo em que a pessoa está — é nele que o link abre. */
  mode: Exclude<PageMode, "editor">;
  project: Parameters<typeof pageShareUrl>[1]["project"];
  sectionId: string;
  publicToken?: string;
  /** `icon` é o botão quadrado das barras; `menu` é a linha com texto do menu do DOC. */
  variant?: "icon" | "menu";
  className?: string;
  iconClassName?: string;
  /** Chamado depois que o aviso de "copiado" já foi visto — o menu do DOC fecha aqui. */
  onDone?: () => void;
}

function IconeLink({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 11-5.656-5.656l1.5-1.5m6.656-6.656l1.5-1.5a4 4 0 115.656 5.656l-3 3a4 4 0 01-5.656 0"
      />
    </svg>
  );
}

function IconeOk({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

/**
 * "Copiar o link desta página".
 *
 * O link abre o mesmo modo já na página. Ele é público quando o projeto tem
 * link público (ou quando a pessoa já chegou por um) e interno quando não tem —
 * e o texto diz qual dos dois foi, porque mandar um link interno para alguém de
 * fora é mandar um "não encontrado".
 */
export default function CopyPageLinkButton({
  mode,
  project,
  sectionId,
  publicToken,
  variant = "icon",
  className = "",
  iconClassName = "h-[17px] w-[17px]",
  onDone,
}: Props) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const { kind, path } = pageShareUrl(mode, { project, sectionId, publicToken });
  const isPublic = kind === "public";

  const label = copied
    ? isPublic
      ? t("pageLink.copiedPublic", "Link público copiado")
      : t("pageLink.copiedInternal", "Link interno copiado")
    : isPublic
      ? t("pageLink.copyPublic", "Copiar link público desta página")
      : t("pageLink.copyInternal", "Copiar link desta página");
  const hint = isPublic
    ? t("pageLink.publicHint", "Qualquer pessoa com o link abre")
    : t("pageLink.internalHint", "Só abre para quem tem acesso ao projeto");

  const copy = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    } catch {
      return; // área de transferência bloqueada: sem aviso falso de "copiado"
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setCopied(false);
      onDone?.();
    }, 1400);
  };

  if (variant === "menu") {
    return (
      <button
        type="button"
        onClick={copy}
        title={hint}
        className={`w-full text-left px-3 py-2 text-sm flex items-start gap-2 ${
          copied ? "text-emerald-700 bg-emerald-50" : "text-gray-700 hover:bg-gray-100"
        } ${className}`}
      >
        {copied ? <IconeOk className="h-4 w-4 shrink-0 mt-0.5" /> : <IconeLink className="h-4 w-4 shrink-0 mt-0.5" />}
        <span className="flex flex-col">
          <span className="whitespace-nowrap">{label}</span>
          <span className={`text-[11px] ${copied ? "text-emerald-600" : "text-gray-400"}`}>{hint}</span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={`${label} — ${hint}`}
      aria-label={label}
      className={`relative ${className} ${copied ? "!text-emerald-600" : ""}`}
    >
      {copied ? <IconeOk className={iconClassName} /> : <IconeLink className={iconClassName} />}
      {copied && (
        <span
          role="status"
          className="pointer-events-none absolute right-0 top-full z-50 mt-1.5 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg"
        >
          {label}
          <span className="block font-normal text-gray-300">{hint}</span>
        </span>
      )}
    </button>
  );
}
