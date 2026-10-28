"use client";

import Link from "next/link";
import { AreaHeader } from "@/components/project/AreaHeader";
import { IconLibrary, IconSystems } from "@/components/project/ProjectSidebar";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Biblioteca e Sistemas ainda não existem, mas já têm lugar na navegação: a
 * tela mostra o que vem, com um exemplo esmaecido, em vez de um "em breve" vazio.
 */
export function AreaComingSoon({ projectId, area }: { projectId: string; area: "library" | "systems" }) {
  const { t } = useI18n();

  if (area === "library") {
    const rows = [
      { name: t("comingSoon.library.example1", "Lâmina do Ponteiro"), a: "15", b: "0,6 s" },
      { name: t("comingSoon.library.example2", "Explosão de Areia"), a: "30", b: "5 s" },
      { name: t("comingSoon.library.example3", "Escudo de Luz"), a: "25", b: "10 s" },
    ];
    return (
      <div className="w-full">
        <AreaHeader
          icon={<IconLibrary className="h-5 w-5" />}
          tone="lib"
          title={t("projectShell.library", "Biblioteca do jogo")}
          lead={t("comingSoon.library.lead", "Tudo o que existe dentro do jogo — personagens, inimigos, itens, magias — com os números de cada um num lugar só.")}
        />
        <SoonBadge />
        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface opacity-70" aria-hidden>
          <div className="grid grid-cols-[1fr_80px_80px] gap-3 border-b border-line bg-surface-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-subtle">
            <span>{t("comingSoon.library.colName", "Magia")}</span>
            <span className="text-right">{t("comingSoon.library.colA", "Mana")}</span>
            <span className="text-right">{t("comingSoon.library.colB", "Recarga")}</span>
          </div>
          {rows.map((row) => (
            <div key={row.name} className="grid grid-cols-[1fr_80px_80px] gap-3 border-b border-line px-4 py-2.5 text-sm last:border-0">
              <span className="flex items-center gap-2.5 font-medium text-ink">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-area-lib-soft text-xs font-bold text-area-lib">{row.name[0]}</span>
                {row.name}
              </span>
              <span className="text-right tabular-nums text-ink-2">{row.a}</span>
              <span className="text-right tabular-nums text-ink-2">{row.b}</span>
            </div>
          ))}
        </div>
        <ul className="mt-6 grid gap-3 sm:grid-cols-3">
          <PromiseCard title={t("comingSoon.library.p1", "Coleções suas")} text={t("comingSoon.library.p1Text", "Você cria a coleção e escolhe as propriedades: mana, recarga, vida, preço…")} />
          <PromiseCard title={t("comingSoon.library.p2", "Números num lugar só")} text={t("comingSoon.library.p2Text", "O texto de cada página fala do papel da coisa; o balanceamento mora na tabela.")} />
          <PromiseCard title={t("comingSoon.library.p3", "Direto para o jogo")} text={t("comingSoon.library.p3Text", "Exporte a coleção para a engine, ligada pelo ID de dado de cada página.")} />
        </ul>
        <p className="mt-6 text-sm text-muted">
          {t("comingSoon.library.meanwhile", "Enquanto isso, crie uma página para cada coisa do jogo na árvore de páginas: elas viram coleção quando a Biblioteca chegar.")}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <AreaHeader
        icon={<IconSystems className="h-5 w-5" />}
        tone="sys"
        title={t("projectShell.systems", "Sistemas e relações")}
        lead={t("comingSoon.systems.lead", "Como as partes do jogo se ligam: o ciclo de progressão, a economia, o que libera o quê — montado das próprias páginas, sem ninguém desenhar setas.")}
        actions={
          <Link
            href={`/projects/${projectId}/mindmap`}
            className="inline-flex h-9 items-center rounded-lg bg-accent px-3 text-sm font-semibold text-on-accent hover:opacity-90"
          >
            {t("comingSoon.systems.mindmap", "Abrir o mapa mental")}
          </Link>
        }
      />
      <SoonBadge />
      <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-surface p-5 opacity-70" aria-hidden>
        <div className="flex min-w-[560px] items-center gap-3 text-sm">
          {[
            t("comingSoon.systems.n1", "Inimigo derrotado"),
            t("comingSoon.systems.n2", "XP"),
            t("comingSoon.systems.n3", "Nível"),
            t("comingSoon.systems.n4", "Ponto de habilidade"),
            t("comingSoon.systems.n5", "Nova magia"),
          ].map((label, i, all) => (
            <span key={label} className="flex items-center gap-3">
              <span className="rounded-xl border border-area-sys/40 bg-area-sys-soft px-3 py-2 font-medium text-ink">{label}</span>
              {i < all.length - 1 && <span className="text-subtle">→</span>}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-6 text-sm text-muted">
        {t("comingSoon.systems.meanwhile", "Enquanto isso, o mapa mental já mostra as páginas e as referências entre elas.")}
      </p>
    </div>
  );
}

function SoonBadge() {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center rounded-full border border-dashed border-line-strong px-3 py-1 text-xs font-medium text-muted">
      {t("comingSoon.badge", "Em construção — este é um exemplo do que vem")}
    </span>
  );
}

function PromiseCard({ title, text }: { title: string; text: string }) {
  return (
    <li className="rounded-xl border border-line bg-surface p-4">
      <strong className="block text-sm text-ink">{title}</strong>
      <span className="mt-1 block text-sm text-muted">{text}</span>
    </li>
  );
}
