"use client";

import Link from "next/link";
import { AreaHeader } from "@/components/project/AreaHeader";
import { IconSystems } from "@/components/project/ProjectSidebar";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Sistemas ainda não existe, mas já tem lugar na navegação: a tela mostra o
 * que vem, com um exemplo esmaecido, em vez de um "em breve" vazio.
 */
export function AreaComingSoon({ projectId }: { projectId: string }) {
  const { t } = useI18n();

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
