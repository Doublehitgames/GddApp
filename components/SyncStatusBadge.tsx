"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProjectStore } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";

const BADGE_UI_KEY = "gdd_sync_badge_ui_v1";

type BadgeUIState = {
  compact: boolean;
  x: number;
  y: number;
};

export default function SyncStatusBadge() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const syncStatus = useProjectStore((s) => s.syncStatus);
  const pendingSyncCount = useProjectStore((s) => s.pendingSyncCount);
  const lastSyncedAt = useProjectStore((s) => s.lastSyncedAt);
  const flushPendingSyncs = useProjectStore((s) => s.flushPendingSyncs);

  const [compact, setCompact] = useState(true);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [positionReady, setPositionReady] = useState(false);

  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const defaultX = Math.max(16, window.innerWidth - 300);
    const defaultY = Math.max(16, window.innerHeight - 120);

    try {
      const raw = localStorage.getItem(BADGE_UI_KEY);
      if (!raw) {
        setPosition({ x: defaultX, y: defaultY });
        setPositionReady(true);
        return;
      }

      const parsed = JSON.parse(raw) as Partial<BadgeUIState>;
      setCompact(parsed.compact ?? true);
      setPosition({
        x: typeof parsed.x === "number" ? parsed.x : defaultX,
        y: typeof parsed.y === "number" ? parsed.y : defaultY,
      });
      setPositionReady(true);
    } catch {
      setPosition({ x: defaultX, y: defaultY });
      setPositionReady(true);
    }
  }, []);

  useEffect(() => {
    if (!positionReady) return;
    try {
      localStorage.setItem(
        BADGE_UI_KEY,
        JSON.stringify({ compact, x: position.x, y: position.y } satisfies BadgeUIState)
      );
    } catch {}
  }, [compact, position, positionReady]);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!draggingRef.current) return;
      const nextX = Math.max(8, Math.min(window.innerWidth - 56, event.clientX - dragOffsetRef.current.x));
      const nextY = Math.max(8, Math.min(window.innerHeight - 56, event.clientY - dragOffsetRef.current.y));
      setPosition({ x: nextX, y: nextY });
    };

    const onMouseUp = () => {
      draggingRef.current = false;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const startDrag = (event: React.MouseEvent<HTMLButtonElement>) => {
    draggingRef.current = true;
    dragOffsetRef.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    };
  };

  if (!user) return null;
  if (pathname?.includes("/mindmap")) return null;
  if (!positionReady) return null;

  const statusText =
    syncStatus === "syncing"
      ? "Sincronizando"
      : syncStatus === "synced"
        ? "Sincronizado"
        : syncStatus === "error"
          ? "Erro"
          : "Aguardando";

  const statusClass =
    syncStatus === "syncing"
      ? "border-blue-700 bg-blue-950/70 text-blue-200"
      : syncStatus === "synced"
        ? "border-green-700 bg-green-950/70 text-green-200"
        : syncStatus === "error"
          ? "border-red-700 bg-red-950/70 text-red-200"
          : "border-gray-700 bg-gray-900/80 text-gray-200";

  return (
      <div className="fixed z-50" style={{ left: position.x, top: position.y }}>
        <div className={`rounded-xl border shadow-xl shadow-black/30 backdrop-blur ${compact ? "px-2 py-2" : "px-3 py-2 min-w-[280px]"} ${statusClass}`}>
          <div className="flex items-center justify-between gap-2">
            <button
              onMouseDown={startDrag}
              title="Arraste para reposicionar"
              className="text-[10px] px-1.5 py-1 rounded bg-black/20 hover:bg-black/30 transition-colors cursor-grab active:cursor-grabbing"
            >
              ⠿
            </button>

            <span className="text-xs font-semibold whitespace-nowrap">☁️ {statusText}</span>

            <button
              onClick={() => setCompact((prev) => !prev)}
              className="text-[10px] px-1.5 py-1 rounded bg-black/20 hover:bg-black/30 transition-colors"
              title={compact ? "Expandir" : "Compactar"}
            >
              {compact ? "▢" : "—"}
            </button>
          </div>

          {compact ? (
            <div className="mt-1 text-[11px] opacity-90">Pendentes: {pendingSyncCount}</div>
          ) : (
            <>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11px] opacity-90">Pendentes: {pendingSyncCount}</span>
                <span className="text-[11px] opacity-80 truncate">
                  {lastSyncedAt ? `Último: ${new Date(lastSyncedAt).toLocaleTimeString()}` : "Ainda sem sync"}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    void flushPendingSyncs();
                  }}
                  className="text-[11px] px-2 py-1 rounded-md bg-blue-700 hover:bg-blue-600 text-white transition-colors"
                >
                  Sincronizar
                </button>
                <Link href="/settings/persistence" className="text-[11px] underline hover:opacity-90">
                  Ajustes
                </Link>
              </div>
            </>
          )}
        </div>
    </div>
  );
}
