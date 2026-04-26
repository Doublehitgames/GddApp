"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { getLocaleLabel, useI18n } from "@/lib/i18n/provider";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuthStore();
  const { t, locale, setLocale, supportedLocales } = useI18n();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    if (mode === "login") {
      const { error } = await signInWithEmail(email, password);
      if (error) {
        setError(error);
      } else {
        router.push("/");
      }
    } else {
      const { error } = await signUpWithEmail(email, password, displayName);
      if (error) {
        setError(error);
      } else {
        setInfo(t("auth.login.signupSuccess"));
      }
    }

    setLoading(false);
  };

  const handleGoogle = async () => {
    setError(null);
    const { error } = await signInWithGoogle();
    if (error) setError(error);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      {/* Persistent docs link — visible from the very first paint so visitors
          can read about the product before/without creating an account. */}
      <Link
        href="/docs"
        className="absolute top-4 right-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-900/80 px-3 py-1.5 text-xs text-gray-200 hover:border-indigo-500 hover:text-white transition-colors"
      >
        <span aria-hidden="true">📚</span>
        <span>Documentação</span>
      </Link>
      <div className="w-full max-w-md">
        {/* Logo / Título */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🎮 GDD Manager</h1>
          <div className="flex justify-center gap-2 mb-3">
            {supportedLocales.map((option) => (
              <button
                key={option}
                onClick={() => setLocale(option)}
                className={`px-3 py-1 rounded-lg text-xs border transition-colors ${
                  locale === option
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-gray-900 border-gray-700 text-gray-300 hover:text-white"
                }`}
              >
                {getLocaleLabel(option)}
              </button>
            ))}
          </div>
          <p className="text-gray-400 text-sm">
            {mode === "login" ? t("auth.login.subtitleLogin") : t("auth.login.subtitleSignup")}
          </p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          {/* Tabs */}
          <div className="flex mb-6 bg-gray-800 rounded-xl p-1">
            <button
              onClick={() => { setMode("login"); setError(null); setInfo(null); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === "login"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {t("auth.login.tabLogin")}
            </button>
            <button
              onClick={() => { setMode("signup"); setError(null); setInfo(null); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === "signup"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {t("auth.login.tabSignup")}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nome (só no signup) */}
            {mode === "signup" && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t("auth.login.name")}</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t("auth.login.namePlaceholder")}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t("auth.login.email")}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.login.emailPlaceholder")}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Senha */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t("auth.login.password")}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.login.passwordPlaceholder")}
                required
                minLength={6}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Erro */}
            {error && (
              <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            {/* Info */}
            {info && (
              <div className="bg-green-900/40 border border-green-700 rounded-xl px-4 py-3 text-green-300 text-sm">
                {info}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading
                ? t("auth.login.loading")
                : mode === "login"
                ? t("auth.login.submit")
                : t("auth.login.submitSignup")}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-700" />
            <span className="text-gray-500 text-xs">{t("auth.login.or")}</span>
            <div className="flex-1 h-px bg-gray-700" />
          </div>

          {/* Google */}
          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white py-3 rounded-xl transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {t("auth.login.withGoogle")}
          </button>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          {t("auth.login.footer")} · {t("common.appName")}
        </p>
      </div>
    </div>
  );
}
