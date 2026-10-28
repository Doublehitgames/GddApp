"use client";

import { useState } from "react";
import { CoverImage } from "@/components/project/ProjectCover";
import { useI18n } from "@/lib/i18n/provider";
import type { ProjectDocumentSpotlight, ProjectStoreLink } from "@/lib/projectSpotlight";

/** "Engine: Godot 4" → ["Engine", "Godot 4"]. Linha sem rótulo fica inteira no valor. */
function splitDetail(line: string): [string, string] {
  const i = line.indexOf(":");
  return i > 0 ? [line.slice(0, i).trim(), line.slice(i + 1).trim()] : ["", line.trim()];
}

type LinkGroup = "stores" | "community" | "site";

const STORE_WORDS = /google play|play store|app store|apple|steam|\bitch\.?io\b|epic games|xbox|playstation|psn|nintendo|eshop|gog|amazon|microsoft store/i;
const COMMUNITY_WORDS = /discord|youtube|instagram|tiktok|facebook|reddit|twitch|twitter|\bx\b|bluesky|threads|mastodon|telegram|whatsapp/i;
const SITE_WORDS = /site|press|imprensa|kit|blog|web|wiki|newsletter/i;

function classify(text: string): LinkGroup | null {
  if (STORE_WORDS.test(text)) return "stores";
  if (COMMUNITY_WORDS.test(text)) return "community";
  if (SITE_WORDS.test(text)) return "site";
  return null;
}

/** O nome do link manda; a URL só desempata quando o nome não diz nada. */
function groupOf(link: ProjectStoreLink): LinkGroup {
  return classify(link.label) ?? classify(link.url) ?? "site";
}

const GROUP_ICON: Record<LinkGroup, React.ReactNode> = {
  stores: <path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2" />,
  community: <path d="M4 5h16v11H9l-5 4zM8 10h8M8 13h5" />,
  site: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.5 5.7 3.5 9s-1 6.3-3.5 9c-2.5-2.7-3.5-5.7-3.5-9s1-6.3 3.5-9z" /></>,
};

const Icon = ({ children, className = "h-4 w-4" }: { children: React.ReactNode; className?: string }) => (
  <svg viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);

/** Detalhe curto cabe em meia largura; lista longa (idiomas, plataformas) ocupa a linha. */
const isLong = (value: string) => value.length > 18 || value.split(",").length > 2;

const LINKS_COLLAPSED = 6;

/**
 * A ficha técnica é dado curto e de consulta — mora no trilho da Visão, para
 * ler de relance. Editar abre o editor completo na coluna principal.
 */
export function SpotlightRail({ spotlight, editing, onEdit }: { spotlight?: ProjectDocumentSpotlight; editing: boolean; onEdit: () => void }) {
  const { t } = useI18n();
  const [allLinks, setAllLinks] = useState(false);
  const features = spotlight?.features ?? [];
  const details = (spotlight?.technicalDetails ?? []).map(splitDetail);
  const links = spotlight?.storeLinks ?? [];
  const empty = !features.length && !details.length && !links.length && !spotlight?.titleIconUrl;

  const groups: { id: LinkGroup; title: string; items: ProjectStoreLink[] }[] = [
    { id: "stores" as const, title: t("visionPage.linksStores", "Lojas"), items: links.filter((l) => groupOf(l) === "stores") },
    { id: "community" as const, title: t("visionPage.linksCommunity", "Comunidade"), items: links.filter((l) => groupOf(l) === "community") },
    { id: "site" as const, title: t("visionPage.linksSite", "Site e imprensa"), items: links.filter((l) => groupOf(l) === "site") },
  ].filter((g) => g.items.length);

  // Recolhido, mostra os primeiros links na ordem dos grupos.
  let budget = allLinks ? Infinity : LINKS_COLLAPSED;
  const shownGroups = groups
    .map((g) => {
      const take = Math.max(0, Math.min(g.items.length, budget));
      budget -= take;
      return { ...g, items: g.items.slice(0, take) };
    })
    .filter((g) => g.items.length);
  const hidden = links.length - shownGroups.reduce((n, g) => n + g.items.length, 0);

  return (
    <aside className="flex flex-col gap-5">
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-4 flex items-center gap-3">
          {spotlight?.titleIconUrl ? (
            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-surface-2">
              <CoverImage src={spotlight.titleIconUrl} alt="" />
            </span>
          ) : (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-area-vis-soft text-area-vis">
              <Icon className="h-5 w-5">
                <path d="M9 4h6M9 4a2 2 0 0 0-2 2h10a2 2 0 0 0-2-2M7 6H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-2M8 11h8M8 15h5" />
              </Icon>
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-ink">{t("visionPage.sheetTitle", "Ficha técnica")}</h2>
            <p className="text-xs text-muted">{t("visionPage.sheetHint", "Aparece em destaque no modo Documento.")}</p>
          </div>
          {!editing && !empty && (
            <button
              type="button"
              onClick={onEdit}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
              aria-label={t("visionPage.sheetEdit", "Editar ficha técnica")}
              title={t("visionPage.sheetEdit", "Editar ficha técnica")}
            >
              <Icon>
                <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3zM13.5 7.5l3 3" />
              </Icon>
            </button>
          )}
        </div>

        {empty ? (
          <button
            type="button"
            onClick={onEdit}
            className="w-full rounded-xl border border-dashed border-line-strong p-4 text-left text-sm text-muted hover:border-accent hover:text-ink"
          >
            {t("visionPage.sheetEmpty", "Plataformas, engine, estilo, público, links das lojas… o resumo técnico do jogo cabe aqui.")}
            <span className="mt-2 block font-medium text-accent">{t("visionPage.sheetFill", "Preencher a ficha")}</span>
          </button>
        ) : (
          <div className="flex flex-col gap-5">
            {features.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {features.map((f, i) => (
                  <span key={`${i}-${f}`} className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
                    {f}
                  </span>
                ))}
              </div>
            )}

            {details.length > 0 && (
              <dl className="grid grid-flow-row-dense grid-cols-2 gap-2">
                {details.map(([label, value], i) => (
                  <div key={`${i}-${label}`} className={`rounded-xl bg-surface-2 px-3 py-2 ${isLong(value) || !label ? "col-span-2" : ""}`}>
                    {label && <dt className="text-[10px] font-semibold uppercase tracking-wider text-subtle">{label}</dt>}
                    <dd className="text-sm font-semibold leading-snug text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {shownGroups.length > 0 && (
              <div className="flex flex-col gap-3">
                {shownGroups.map((g) => (
                  <div key={g.id}>
                    <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">
                      <Icon className="h-3.5 w-3.5">{GROUP_ICON[g.id]}</Icon>
                      {g.title}
                    </h3>
                    <div className="grid grid-cols-2 gap-1.5">
                      {g.items.map((link, i) => (
                        <a
                          key={`${i}-${link.url}`}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          title={link.url}
                          className="flex min-w-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink hover:border-line-strong hover:bg-surface-2"
                        >
                          <span className="min-w-0 flex-1 truncate">{link.label}</span>
                          <span className="text-subtle" aria-hidden>
                            ↗
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
                {(hidden > 0 || allLinks) && links.length > LINKS_COLLAPSED && (
                  <button type="button" onClick={() => setAllLinks((v) => !v)} className="self-start text-xs font-medium text-accent hover:underline">
                    {allLinks
                      ? t("visionPage.linksLess", "Mostrar menos")
                      : t("visionPage.linksMore", "+{n} links").replace("{n}", String(hidden))}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </aside>
  );
}
