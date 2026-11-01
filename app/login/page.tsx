"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { getLocaleLabel, useI18n } from "@/lib/i18n/provider";
import type { AppLocale } from "@/lib/i18n/config";
import { IconVision } from "@/components/project/ProjectSidebar";
import { LoginPitchCarousel } from "@/components/login/LoginPitchCarousel";
import { LEGAL_OPERATOR, LEGAL_OPERATOR_URL, LEGAL_UI, legalHref, legalPage, pick } from "@/lib/legal/pages";

type Mode = "login" | "signup";

/**
 * A ilustração mora em public/login/ de propósito: o proxy só deixa passar sem
 * sessão o que começa com uma rota pública, e /login é uma delas.
 */
const HERO_IMAGE = "/login/hero.webp";

/** Frases da tela que não existem em locales/*.json — moram aqui, nos três idiomas. */
const COPY: Record<AppLocale, {
  tagline: string;
  welcomeTitle: string;
  welcomeText: string;
  signupTitle: string;
  signupText: string;
  showPassword: string;
  hidePassword: string;
  help: string;
}> = {
  "pt-BR": {
    tagline: "Game Design Workspace",
    welcomeTitle: "Bem-vindo de volta!",
    welcomeText: "Entre na sua conta para continuar criando mundos incríveis.",
    signupTitle: "Vamos começar!",
    signupText: "Crie sua conta e dê forma ao primeiro mundo.",
    showPassword: "Mostrar senha",
    hidePassword: "Esconder senha",
    help: "Ajuda",
  },
  en: {
    tagline: "Game Design Workspace",
    welcomeTitle: "Welcome back!",
    welcomeText: "Sign in to keep building amazing worlds.",
    signupTitle: "Let's get started!",
    signupText: "Create your account and shape your first world.",
    showPassword: "Show password",
    hidePassword: "Hide password",
    help: "Help",
  },
  es: {
    tagline: "Game Design Workspace",
    welcomeTitle: "¡Bienvenido de nuevo!",
    welcomeText: "Entra en tu cuenta para seguir creando mundos increíbles.",
    signupTitle: "¡Empecemos!",
    signupText: "Crea tu cuenta y da forma a tu primer mundo.",
    showPassword: "Mostrar contraseña",
    hidePassword: "Ocultar contraseña",
    help: "Ayuda",
  },
};

const icon = (path: React.ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {path}
  </svg>
);
const ICONS = {
  user: icon(<><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" /></>),
  plus: icon(<path d="M12 5v14M5 12h14" />),
  mail: icon(<><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="M4 7l8 6 8-6" /></>),
  lock: icon(<><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 15v2" /></>),
  eye: icon(<><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>),
  eyeOff: icon(<><path d="M3 3l18 18M10.6 6a9.5 9.5 0 0 1 1.4-.1C18 5.9 21.5 12 21.5 12a17 17 0 0 1-3 3.7M6.3 6.9A17 17 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4.2-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>),
  enter: icon(<path d="M10 17l5-5-5-5M15 12H3M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5" />),
};

/** Só aceita paths internos ("/...") — evita open redirect via ?next=. */
function safeNextPath(next: string | null): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuthStore();
  const { t, locale, setLocale, supportedLocales } = useI18n();
  const copy = pick(COPY, locale);

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
  };

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
        router.push(nextPath ?? "/");
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
    const { error } = await signInWithGoogle(nextPath ?? undefined);
    if (error) setError(error);
  };

  const tab = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-2 border-b-2 pb-3 text-[15px] font-medium transition-colors ${
      active ? "border-accent text-accent" : "border-line text-muted hover:text-ink"
    }`;
  const field =
    "flex items-center gap-3 rounded-xl border border-line bg-surface px-4 text-subtle transition-colors focus-within:border-accent focus-within:text-accent";
  const input = "h-12 min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-subtle focus:outline-none";

  return (
    // A ilustração é de dia: a tela de entrada fica sempre no tema claro, como o Modo Doc.
    <div data-theme="light" className="relative isolate min-h-screen overflow-hidden bg-canvas text-ink">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[46vh] bg-cover bg-[position:25%_center] lg:inset-0 lg:h-auto lg:bg-[position:30%_center]"
        style={{ backgroundImage: `url(${HERO_IMAGE})` }}
      />
      {/* Véu claro: no celular funde a ilustração no fundo; no desktop clareia o canto do título. */}
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[46vh] bg-gradient-to-b from-canvas/10 via-canvas/30 to-canvas lg:hidden" />
      <div aria-hidden className="absolute inset-0 -z-10 hidden bg-[radial-gradient(ellipse_70%_60%_at_20%_25%,var(--canvas)_0%,color-mix(in_srgb,var(--canvas)_70%,transparent)_45%,transparent_75%)] lg:block" />

      <div className="absolute right-4 top-4 z-10 flex items-center gap-1.5 md:right-8 md:top-6">
        {supportedLocales.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setLocale(option)}
            aria-pressed={locale === option}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              locale === option ? "bg-accent text-on-accent" : "bg-surface/80 text-ink backdrop-blur hover:bg-surface"
            }`}
          >
            {getLocaleLabel(option)}
          </button>
        ))}
      </div>

      <div className="mx-auto grid min-h-screen w-full max-w-7xl gap-8 px-4 pb-10 pt-16 md:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:items-center lg:gap-12 lg:py-12">
        <section className="flex flex-col justify-start lg:self-start lg:pt-10">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-accent text-on-accent shadow-lg shadow-accent/30 md:h-20 md:w-20">
              <IconVision className="h-8 w-8 md:h-10 md:w-10" />
            </span>
            <span>
              <span className="block text-4xl font-bold tracking-tight md:text-5xl">{t("common.appName", "GDD Manager")}</span>
              <span className="mt-1 block text-sm font-medium text-muted md:text-base">{copy.tagline}</span>
            </span>
          </div>
          <LoginPitchCarousel locale={locale} className="mt-10 hidden lg:block" />
        </section>

        <div className="mt-[22vh] w-full lg:mt-0">
          <div className="rounded-3xl border border-line bg-surface/95 p-6 shadow-2xl shadow-black/10 backdrop-blur md:p-9">
            <div className="flex gap-4" role="tablist">
              <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => switchMode("login")} className={tab(mode === "login")}>
                {ICONS.user}
                {t("auth.login.tabLogin")}
              </button>
              <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => switchMode("signup")} className={tab(mode === "signup")}>
                {ICONS.plus}
                {t("auth.login.tabSignup")}
              </button>
            </div>

            <h2 className="mt-8 text-2xl font-bold tracking-tight md:text-3xl">{mode === "login" ? copy.welcomeTitle : copy.signupTitle}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{mode === "login" ? copy.welcomeText : copy.signupText}</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-3">
              {mode === "signup" && (
                <label className={field}>
                  {ICONS.user}
                  <span className="sr-only">{t("auth.login.name")}</span>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={t("auth.login.namePlaceholder")}
                    autoComplete="name"
                    className={input}
                  />
                </label>
              )}

              <label className={field}>
                {ICONS.mail}
                <span className="sr-only">{t("auth.login.email")}</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("auth.login.emailPlaceholder")}
                  autoComplete="email"
                  required
                  className={input}
                />
              </label>

              <label className={field}>
                {ICONS.lock}
                <span className="sr-only">{t("auth.login.password")}</span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("auth.login.passwordPlaceholder")}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  minLength={6}
                  className={input}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                  title={showPassword ? copy.hidePassword : copy.showPassword}
                  className="rounded-md p-1 text-subtle hover:text-ink"
                >
                  {showPassword ? ICONS.eye : ICONS.eyeOff}
                </button>
              </label>

              {error && (
                <div className="rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>
              )}
              {info && (
                <div className="rounded-xl border border-area-doc/40 bg-area-doc-soft px-4 py-3 text-sm text-area-doc">{info}</div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full items-center justify-center gap-2.5 rounded-xl bg-accent py-3.5 text-base font-semibold text-on-accent shadow-lg shadow-accent/25 transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
              >
                {ICONS.enter}
                {loading ? t("auth.login.loading") : mode === "login" ? t("auth.login.submit") : t("auth.login.submitSignup")}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-line" />
              <span className="text-xs text-subtle">{t("auth.login.or")}</span>
              <div className="h-px flex-1 bg-line" />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface py-3 text-[15px] font-medium text-ink transition-colors hover:bg-surface-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {t("auth.login.withGoogle")}
            </button>

            <p className="mt-5 text-center text-xs leading-relaxed text-muted">
              {pick(LEGAL_UI.consentPrefix, locale)}{" "}
              <Link href={legalHref("termos")} className="font-medium text-ink underline-offset-2 hover:underline">
                {pick(legalPage("termos").title, locale)}
              </Link>{" "}
              {pick(LEGAL_UI.consentAnd, locale)}{" "}
              <Link href={legalHref("privacidade")} className="font-medium text-ink underline-offset-2 hover:underline">
                {pick(legalPage("privacidade").title, locale)}
              </Link>
              .
            </p>
          </div>

          <div className="mx-auto mt-5 w-fit max-w-full rounded-2xl bg-surface/80 px-5 py-3 backdrop-blur">
          <nav aria-label={pick(LEGAL_UI.navLabel, locale)} className="flex flex-wrap items-center justify-center gap-y-1.5 text-[13px] text-ink">
            {[
              { href: legalHref("termos"), label: pick(legalPage("termos").title, locale) },
              { href: legalHref("privacidade"), label: pick(legalPage("privacidade").title, locale) },
              { href: "/legal", label: pick(LEGAL_UI.navLabel, locale) },
              { href: "/docs", label: copy.help },
            ].map((l, i) => (
              <span key={l.href} className="flex items-center whitespace-nowrap">
                {i > 0 && <span aria-hidden className="px-2 text-line-strong">|</span>}
                <Link href={l.href} className="hover:text-accent">
                  {l.label}
                </Link>
              </span>
            ))}
          </nav>
          <p className="mt-2 text-center text-xs text-muted">
            © {new Date().getFullYear()}{" "}
            <a href={LEGAL_OPERATOR_URL} target="_blank" rel="noopener noreferrer" className="hover:text-ink">
              {LEGAL_OPERATOR}
            </a>{" "}
            · {t("auth.login.footer")} <span aria-hidden className="text-accent">♥</span>
          </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// useSearchParams exige um boundary de Suspense no App Router.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}
