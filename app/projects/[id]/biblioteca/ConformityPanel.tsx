"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import {
  columnExtremes,
  groupIssues,
  rankShifts,
  type Extremes,
  type IssueGroup,
  type PageAudit,
  type RankShift,
} from "@/lib/library/audit";
import { readSeenExtremes, writeSeenExtremes } from "@/lib/library/extremesSeen";
import type { Backlink } from "@/lib/library/relations";
import type { TableRule } from "@/lib/tableRule/tableRule";
import type { Section } from "@/store/slices/types";

/**
 * O painel de conferência: o que falta, o que está escrito torto e quem
 * deixou de ser a ponta de uma coluna. É o motivo de a regra existir —
 * ordenar é conveniência; saber o que está errado é o produto.
 */
export function ConformityPanel({
  collectionId,
  rule,
  items,
  audits,
  backlinks,
  onSelect,
}: {
  collectionId: string;
  rule: TableRule;
  items: Section[];
  audits: PageAudit<Section>[];
  backlinks: Map<string, Backlink[]>;
  onSelect: (id: string) => void;
}) {
  const { t } = useI18n();
  const groups = useMemo(() => groupIssues(rule, audits), [rule, audits]);
  const complete = audits.filter((a) => a.issues.length === 0).length;

  // O "antes" das pontas vem do aparelho. A primeira visita só registra —
  // não há o que ter virado em relação a nada.
  const now = useMemo(() => columnExtremes(rule, items), [rule, items]);
  const [seen, setSeen] = useState<Extremes | null>(null);
  // O mesmo jeito do marcador do changelog: o localStorage só existe depois de montar.
  useEffect(() => {
    setSeen(readSeenExtremes(collectionId));
  }, [collectionId]);
  useEffect(() => {
    if (seen === null && readSeenExtremes(collectionId) === null) writeSeenExtremes(collectionId, now);
  }, [seen, collectionId, now]);
  const shifts = useMemo<RankShift[]>(() => (seen ? rankShifts(rule, seen, now) : []), [rule, seen, now]);
  const acknowledge = () => {
    writeSeenExtremes(collectionId, now);
    setSeen(now);
  };

  const byId = useMemo(() => new Map(items.map((s) => [s.id, s])), [items]);
  const nothing = groups.length === 0 && shifts.length === 0;
  const [open, setOpen] = useState(false);

  return (
    <section className="mb-5 rounded-2xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        disabled={nothing}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left disabled:cursor-default"
      >
        <span className="text-sm font-semibold text-ink">{t("libraryPage.audit.title", "Conferência")}</span>
        <span className="text-sm tabular-nums text-muted">
          {t("libraryPage.audit.complete", "{n} de {total} completas")
            .replace("{n}", String(complete))
            .replace("{total}", String(audits.length))}
        </span>
        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <span className="block h-full rounded-full bg-area-lib" style={{ width: `${audits.length ? (complete / audits.length) * 100 : 0}%` }} />
        </span>
        {groups.length > 0 && (
          <span className="rounded-md bg-warn-soft px-1.5 py-0.5 text-xs font-medium text-warn-ink">
            {(groups.length === 1 ? t("libraryPage.audit.issuesOne", "1 aviso") : t("libraryPage.audit.issuesMany", "{n} avisos")).replace(
              "{n}",
              String(groups.length),
            )}
          </span>
        )}
        {shifts.length > 0 && (
          <span className="rounded-md bg-area-lib-soft px-1.5 py-0.5 text-xs font-medium text-area-lib">
            {(shifts.length === 1 ? t("libraryPage.audit.shiftsOne", "1 ponta mudou") : t("libraryPage.audit.shiftsMany", "{n} pontas mudaram")).replace(
              "{n}",
              String(shifts.length),
            )}
          </span>
        )}
        {nothing ? (
          <span className="ml-auto text-sm text-muted">{t("libraryPage.audit.allGood", "nada a conferir")}</span>
        ) : (
          <span className={`ml-auto text-subtle transition-transform ${open ? "rotate-90" : ""}`}>›</span>
        )}
      </button>

      {open && !nothing && (
        <div className="flex flex-col gap-4 border-t border-line px-4 py-3">
          {shifts.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-subtle">
                  {t("libraryPage.audit.shiftsTitle", "Quem está na ponta mudou")}
                </h4>
                <button type="button" onClick={acknowledge} className="ml-auto rounded-lg border border-line px-2 py-0.5 text-xs text-ink hover:bg-surface-2">
                  {t("libraryPage.audit.acknowledge", "Já conferi")}
                </button>
              </div>
              <p className="mb-2 text-xs text-muted">
                {t(
                  "libraryPage.audit.shiftsHint",
                  "Texto que fala da maior ou da menor pode ter deixado de ser verdade. As páginas que citam a antiga ponta são as primeiras a conferir.",
                )}
              </p>
              <ul className="flex flex-col gap-1.5">
                {shifts.map((shift) => {
                  const before = byId.get(shift.before);
                  const after = byId.get(shift.now);
                  if (!before || !after) return null;
                  const citing = backlinks.get(before.id)?.length ?? 0;
                  return (
                    <li key={shift.key + shift.end} className="text-sm text-ink-2">
                      <span className="font-medium text-ink">{shift.column}</span>
                      <span className="text-subtle"> · {shift.table}</span>
                      {" — "}
                      {(shift.end === "max"
                        ? t("libraryPage.audit.shiftMax", "o maior valor era de {before}, agora é de {now}")
                        : t("libraryPage.audit.shiftMin", "o menor valor era de {before}, agora é de {now}")
                      )
                        .split(/(\{before\}|\{now\})/)
                        .map((part, i) =>
                          part === "{before}" ? (
                            <PageButton key={i} page={before} onSelect={onSelect} />
                          ) : part === "{now}" ? (
                            <PageButton key={i} page={after} onSelect={onSelect} />
                          ) : (
                            <span key={i}>{part}</span>
                          ),
                        )}
                      {citing > 0 && (
                        <span className="text-muted">
                          {" · "}
                          {(citing === 1
                            ? t("libraryPage.audit.citingOne", "1 página cita {page}")
                            : t("libraryPage.audit.citingMany", "{n} páginas citam {page}")
                          )
                            .replace("{n}", String(citing))
                            .replace("{page}", before.title)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {groups.length > 0 && (
            <ul className="flex flex-col gap-2">
              {groups.map((group) => (
                <IssueRow key={[group.kind, group.table, group.column, group.detail].join("|")} group={group} onSelect={onSelect} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function IssueRow({ group, onSelect }: { group: IssueGroup<Section>; onSelect: (id: string) => void }) {
  const { t } = useI18n();
  const label = {
    missing: t("libraryPage.audit.missing", "falta"),
    notNumber: t("libraryPage.audit.notNumber", "não é número"),
    brokenRef: t("libraryPage.audit.brokenRef", "referência que não acha página"),
    unknownColumn: t("libraryPage.audit.unknownColumn", "coluna que a regra não conhece"),
  }[group.kind];
  const tone = group.kind === "missing" ? "bg-warn-soft text-warn-ink" : "bg-danger-soft text-danger";
  const shown = group.pages.slice(0, 8);
  return (
    <li className="text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${tone}`}>{label}</span>
        <span className="font-medium text-ink">{group.column}</span>
        <span className="text-subtle">· {group.table}</span>
        {group.detail && <code className="rounded bg-surface-2 px-1 text-xs text-ink-2">$[{group.detail}]</code>}
        <span className="ml-auto text-xs tabular-nums text-muted">
          {(group.pages.length === 1 ? t("libraryPage.audit.pagesOne", "1 página") : t("libraryPage.audit.pagesMany", "{n} páginas")).replace(
            "{n}",
            String(group.pages.length),
          )}
        </span>
      </div>
      <p className="mt-0.5 leading-relaxed">
        {shown.map((page, i) => (
          <span key={page.id}>
            {i > 0 && <span className="text-subtle">, </span>}
            <PageButton page={page} onSelect={onSelect} />
          </span>
        ))}
        {group.pages.length > shown.length && <span className="text-subtle"> +{group.pages.length - shown.length}</span>}
      </p>
    </li>
  );
}

function PageButton({ page, onSelect }: { page: Section; onSelect: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onSelect(page.id)} className="text-accent hover:underline">
      {page.title}
    </button>
  );
}
