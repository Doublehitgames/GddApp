import type { AppLocale } from "@/lib/i18n/config";

/**
 * As cinco páginas públicas sobre os dados de quem usa o GDD: termos,
 * privacidade, apagar a conta, exportar e o que acontece se o site mudar.
 * Ficam em /legal/<slug>, abertas sem login (ver PUBLIC_ROUTES no proxy), e
 * aparecem como cartões na home e no índice /legal.
 *
 * O texto mora aqui e não em locales/*.json: é longo, muda junto com a página
 * e não é reaproveitado em lugar nenhum do app.
 */

export type LegalSlug = "termos" | "privacidade" | "esquecimento" | "exportar" | "garantias";

type Localized = Record<AppLocale, string>;

export type LegalPageMeta = {
  slug: LegalSlug;
  number: number;
  /** Classes de cor do número e do realce — tokens do tema, nunca hex. */
  tile: string;
  soft: string;
  title: Localized;
  summary: Localized;
};

/** Quem responde pelo GDD nos textos legais. */
export const LEGAL_OPERATOR = "GGMID Games";
/** Site de quem mantém o GDD — usado como link no nome e no rodapé. */
export const LEGAL_OPERATOR_URL = "https://ggmid.app";
export const LEGAL_APP_URL = "https://gdd.ggmid.app";
export const LEGAL_CONTACT_EMAIL = "doublehitgames@gmail.com";
/** Data da última revisão dos textos — trocar ao mudar qualquer um deles. */
export const LEGAL_UPDATED_AT = "2026-11-01";

export const LEGAL_PAGES: LegalPageMeta[] = [
  {
    slug: "termos",
    number: 1,
    tile: "bg-area-sys text-white",
    soft: "bg-area-sys-soft",
    title: { "pt-BR": "Termos de uso", en: "Terms of use", es: "Términos de uso" },
    summary: {
      "pt-BR": "As regras do combinado entre você e o GDD.",
      en: "The ground rules between you and GDD.",
      es: "Las reglas del acuerdo entre tú y GDD.",
    },
  },
  {
    slug: "privacidade",
    number: 2,
    tile: "bg-area-vis text-white",
    soft: "bg-area-vis-soft",
    title: { "pt-BR": "Política de privacidade", en: "Privacy policy", es: "Política de privacidad" },
    summary: {
      "pt-BR": "Quem tem acesso aos seus dados e como eles são usados.",
      en: "Who can see your data and how it is used.",
      es: "Quién accede a tus datos y cómo se usan.",
    },
  },
  {
    slug: "esquecimento",
    number: 3,
    tile: "bg-area-doc text-white",
    soft: "bg-area-doc-soft",
    title: { "pt-BR": "Direito ao esquecimento", en: "Right to be forgotten", es: "Derecho al olvido" },
    summary: {
      "pt-BR": "Apague a sua conta e todos os seus dados (LGPD).",
      en: "Delete your account and all of your data.",
      es: "Borra tu cuenta y todos tus datos.",
    },
  },
  {
    slug: "exportar",
    number: 4,
    tile: "bg-area-lib text-white",
    soft: "bg-area-lib-soft",
    title: { "pt-BR": "Exportar os dados", en: "Export your data", es: "Exportar tus datos" },
    summary: {
      "pt-BR": "Baixe tudo o que é seu, em vários formatos.",
      en: "Download everything that is yours, in several formats.",
      es: "Descarga todo lo que es tuyo, en varios formatos.",
    },
  },
  {
    slug: "garantias",
    number: 5,
    tile: "bg-danger text-white",
    soft: "bg-danger-soft",
    title: { "pt-BR": "Garantias e continuidade", en: "Guarantees and continuity", es: "Garantías y continuidad" },
    summary: {
      "pt-BR": "O que acontece com o seu GDD se o site sair do ar ou mudar.",
      en: "What happens to your GDD if the site goes down or changes.",
      es: "Qué pasa con tu GDD si el sitio se cae o cambia.",
    },
  },
];

/** As frases da casca (menu, home, login) nos três idiomas. */
export const LEGAL_UI = {
  navLabel: { "pt-BR": "Seus dados e garantias", en: "Your data and guarantees", es: "Tus datos y garantías" },
  indexLead: {
    "pt-BR": "O seu GDD é seu. Aqui está, em linguagem de gente, o que combinamos, o que fazemos com os seus dados e como levar tudo embora quando quiser.",
    en: "Your GDD is yours. Here is, in plain words, what we agree on, what we do with your data and how to take everything with you whenever you want.",
    es: "Tu GDD es tuyo. Aquí está, en palabras simples, lo que acordamos, qué hacemos con tus datos y cómo llevarte todo cuando quieras.",
  },
  homeLead: {
    "pt-BR": "O seu GDD é seu: o que combinamos e como levar tudo embora quando quiser.",
    en: "Your GDD is yours: what we agree on and how to take everything with you whenever you want.",
    es: "Tu GDD es tuyo: lo que acordamos y cómo llevarte todo cuando quieras.",
  },
  updatedAt: { "pt-BR": "Atualizado em", en: "Updated on", es: "Actualizado el" },
  backToProjects: { "pt-BR": "Meus projetos", en: "My projects", es: "Mis proyectos" },
  signIn: { "pt-BR": "Entrar", en: "Sign in", es: "Entrar" },
  consentPrefix: {
    "pt-BR": "Ao entrar ou criar uma conta, você concorda com os",
    en: "By signing in or creating an account, you agree to the",
    es: "Al entrar o crear una cuenta, aceptas los",
  },
  consentAnd: { "pt-BR": "e a", en: "and the", es: "y la" },
  maintainedBy: { "pt-BR": "Mantido por", en: "Maintained by", es: "Mantenido por" },
} satisfies Record<string, Localized>;

export function legalPage(slug: LegalSlug): LegalPageMeta {
  return LEGAL_PAGES.find((p) => p.slug === slug)!;
}

export function legalHref(slug: LegalSlug): string {
  return `/legal/${slug}`;
}

/** Escolhe o texto do idioma de quem lê, com o português como reserva. */
export function pick<T>(byLocale: Record<AppLocale, T>, locale: AppLocale): T {
  return byLocale[locale] ?? byLocale["pt-BR"];
}
