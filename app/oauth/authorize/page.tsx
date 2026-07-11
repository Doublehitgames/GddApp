/**
 * GET /oauth/authorize — tela de consentimento OAuth do MCP remoto.
 *
 * Server component: valida os parâmetros, exige sessão Supabase (senão manda
 * pro /login com retorno) e mostra o que o cliente vai poder fazer.
 * Erros de client/redirect_uri são exibidos aqui — nunca redirecionados.
 * Locale resolvido server-side (cookie → Accept-Language) porque visitantes
 * chegam aqui sem sessão, direto do claude.ai.
 */
import Link from "next/link";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { getClient, OAUTH_SCOPE } from "@/lib/oauth";
import { getServerT } from "@/lib/i18n/server";
import { approveAuthorization, denyAuthorization } from "./actions";

type SearchParams = { [key: string]: string | string[] | undefined };

function param(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return typeof v === "string" ? v : undefined;
}

function ErrorCard({ title, detail }: { title: string; detail: string }) {
  return (
    <Shell>
      <h1 className="text-xl font-bold text-white mb-2">{title}</h1>
      <p className="text-gray-400 text-sm">{detail}</p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white">🎮 GDD Manager</h1>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          {children}
        </div>
      </div>
    </div>
  );
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const t = await getServerT();

  const clientId = param(sp, "client_id");
  const redirectUri = param(sp, "redirect_uri");
  const responseType = param(sp, "response_type");
  const state = param(sp, "state");
  const codeChallenge = param(sp, "code_challenge");
  const codeChallengeMethod = param(sp, "code_challenge_method") ?? "S256";
  const scope = param(sp, "scope") ?? OAUTH_SCOPE;

  if (!clientId || !redirectUri) {
    return (
      <ErrorCard
        title={t("auth.oauthConsent.invalidRequestTitle")}
        detail={t("auth.oauthConsent.missingParams")}
      />
    );
  }

  const client = await getClient(clientId);
  if (!client) {
    return (
      <ErrorCard
        title={t("auth.oauthConsent.unknownClientTitle")}
        detail={t("auth.oauthConsent.unknownClientDetail")}
      />
    );
  }
  if (!client.redirect_uris.includes(redirectUri)) {
    return (
      <ErrorCard
        title={t("auth.oauthConsent.badRedirectTitle")}
        detail={t("auth.oauthConsent.badRedirectDetail")}
      />
    );
  }

  // A partir daqui a redirect_uri é confiável — erros de protocolo voltam pro cliente.
  if (responseType !== "code" || !codeChallenge || codeChallengeMethod !== "S256") {
    return (
      <ErrorCard
        title={t("auth.oauthConsent.invalidRequestTitle")}
        detail={
          responseType !== "code"
            ? t("auth.oauthConsent.unsupportedResponseType")
            : t("auth.oauthConsent.pkceRequired")
        }
      />
    );
  }

  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const clientName = client.client_name ?? t("auth.oauthConsent.defaultClientName");
  const [introBefore, introAfter] = t("auth.oauthConsent.connectIntro").split("{{client}}");
  const [wantsBefore, wantsAfter] = t("auth.oauthConsent.clientWants").split("{{client}}");

  if (!user) {
    const currentUrl = `/oauth/authorize?${new URLSearchParams(
      Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]
    ).toString()}`;
    return (
      <Shell>
        <h1 className="text-xl font-bold text-white mb-2">
          {t("auth.oauthConsent.connectTitle")}
        </h1>
        <p className="text-gray-400 text-sm mb-6">
          {introBefore}
          <span className="text-white font-medium">{clientName}</span>
          {introAfter}
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(currentUrl)}`}
          className="block w-full text-center bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {t("auth.oauthConsent.loginCta")}
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-xl font-bold text-white mb-1">
        {t("auth.oauthConsent.authorizeTitle")}
      </h1>
      <p className="text-gray-500 text-xs mb-5">
        {t("auth.oauthConsent.signedInAs")} <span className="text-gray-300">{user.email}</span>
      </p>

      <p className="text-gray-300 text-sm mb-4">
        {wantsBefore}
        <span className="text-white font-medium">{clientName}</span>
        {wantsAfter}
      </p>
      <ul className="text-sm text-gray-400 space-y-2 mb-6">
        <li className="flex gap-2">
          <span aria-hidden="true">📖</span> {t("auth.oauthConsent.permRead")}
        </li>
        <li className="flex gap-2">
          <span aria-hidden="true">✏️</span> {t("auth.oauthConsent.permWrite")}
        </li>
        <li className="flex gap-2">
          <span aria-hidden="true">🗑️</span> {t("auth.oauthConsent.permDelete")}
        </li>
      </ul>

      <div className="flex gap-3">
        <form action={denyAuthorization} className="flex-1">
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="redirect_uri" value={redirectUri} />
          {state && <input type="hidden" name="state" value={state} />}
          <button
            type="submit"
            className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 font-semibold py-3 rounded-xl transition-colors"
          >
            {t("auth.oauthConsent.deny")}
          </button>
        </form>
        <form action={approveAuthorization} className="flex-1">
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="redirect_uri" value={redirectUri} />
          <input type="hidden" name="code_challenge" value={codeChallenge} />
          <input type="hidden" name="scope" value={scope} />
          {state && <input type="hidden" name="state" value={state} />}
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {t("auth.oauthConsent.approve")}
          </button>
        </form>
      </div>

      <p className="text-gray-600 text-xs mt-5">{t("auth.oauthConsent.revokeNote")}</p>
    </Shell>
  );
}
