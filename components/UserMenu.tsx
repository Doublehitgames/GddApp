"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { getLocaleLabel, useI18n } from "@/lib/i18n/provider";
import { openShortcutsHelp } from "@/components/KeyboardShortcutsModal";

export default function UserMenu() {
  const { user, profile, signOut } = useAuthStore();
  const { locale, setLocale, supportedLocales } = useI18n();
  const [open, setOpen] = useState(false);

  const tr = (pt: string, en: string, es: string) => {
    switch (locale) {
      case "es":
        return es;
      case "en":
        return en;
      default:
        return pt;
    }
  };

  if (!user) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 transition-colors font-medium text-sm text-white"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
        </svg>
        {tr("Entrar", "Log in", "Iniciar sesión")}
      </Link>
    );
  }

  const name = profile?.display_name || user.email?.split("@")[0] || tr("Usuário", "User", "Usuario");
  const email = user.email || "";
  const initials = name.slice(0, 2).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/login";
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
        title={email}
      >
        <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">
          {initials}
        </div>
        <span className="text-sm text-gray-300 hidden sm:block max-w-[120px] truncate">{name}</span>
        <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-20 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800">
              <p className="text-sm font-medium text-white truncate">{name}</p>
              <p className="text-xs text-gray-500 truncate">{email}</p>
            </div>

            <div className="p-1">
              <div className="px-1 pb-1 mb-1 border-b border-gray-800">
                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2"
                >
                  <span>👤</span>
                  <span>{tr("Perfil e plano", "Profile and plan", "Perfil y plan")}</span>
                </Link>
                <Link
                  href="/settings/ai"
                  onClick={() => setOpen(false)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2"
                >
                  <span>⚙️</span>
                  <span>{tr("Configurações de IA", "AI settings", "Configuración de IA")}</span>
                </Link>
                <Link
                  href="/settings/persistence"
                  onClick={() => setOpen(false)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2"
                >
                  <span>💾</span>
                  <span>{tr("Persistência", "Persistence", "Persistencia")}</span>
                </Link>
                <Link
                  href="/settings/api-keys"
                  onClick={() => setOpen(false)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2"
                >
                  <span>🔑</span>
                  <span>{tr("Chaves de API", "API Keys", "Claves de API")}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    openShortcutsHelp();
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 rounded-lg transition-colors flex items-center justify-between gap-2"
                >
                  <span className="flex items-center gap-2">
                    <span>⌨️</span>
                    <span>{tr("Atalhos de teclado", "Keyboard shortcuts", "Atajos de teclado")}</span>
                  </span>
                  <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-gray-700 bg-gray-800 text-gray-400">?</kbd>
                </button>
              </div>

              <div className="px-3 py-2">
                <label className="text-xs text-gray-400 block mb-1">
                  {tr("Idioma", "Language", "Idioma")}
                </label>
                <select
                  value={locale}
                  onChange={(event) => setLocale(event.target.value as typeof locale)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-200"
                >
                  {supportedLocales.map((item) => (
                    <option key={item} value={item}>
                      {getLocaleLabel(item)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleSignOut}
                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-900/30 rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {tr("Sair", "Sign out", "Cerrar sesión")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
