/**
 * GET /oauth/authorize — tela de consentimento OAuth do MCP remoto.
 *
 * Server component: valida os parâmetros, exige sessão Supabase (senão manda
 * pro /login com retorno) e mostra o que o cliente vai poder fazer.
 * Erros de client/redirect_uri são exibidos aqui — nunca redirecionados.
 */
import Link from "next/link";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { getClient, OAUTH_SCOPE } from "@/lib/oauth";
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
        title="Solicitação inválida"
        detail="Parâmetros client_id e redirect_uri são obrigatórios."
      />
    );
  }

  const client = await getClient(clientId);
  if (!client) {
    return (
      <ErrorCard title="Cliente desconhecido" detail="Esse client_id não está registrado." />
    );
  }
  if (!client.redirect_uris.includes(redirectUri)) {
    return (
      <ErrorCard
        title="Redirecionamento não autorizado"
        detail="A redirect_uri informada não corresponde ao cadastro desse cliente."
      />
    );
  }

  // A partir daqui a redirect_uri é confiável — erros de protocolo voltam pro cliente.
  if (responseType !== "code" || !codeChallenge || codeChallengeMethod !== "S256") {
    const url = new URL(redirectUri);
    url.searchParams.set(
      "error",
      responseType !== "code" ? "unsupported_response_type" : "invalid_request"
    );
    if (state) url.searchParams.set("state", state);
    return (
      <ErrorCard
        title="Solicitação inválida"
        detail={
          responseType !== "code"
            ? "Só o fluxo authorization code (com PKCE S256) é suportado."
            : "PKCE (code_challenge com método S256) é obrigatório."
        }
      />
    );
  }

  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const clientName = client.client_name ?? "Aplicativo externo";

  if (!user) {
    const currentUrl = `/oauth/authorize?${new URLSearchParams(
      Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]
    ).toString()}`;
    return (
      <Shell>
        <h1 className="text-xl font-bold text-white mb-2">Conectar ao GDD Manager</h1>
        <p className="text-gray-400 text-sm mb-6">
          <span className="text-white font-medium">{clientName}</span> quer acessar seus
          documentos de game design. Entre na sua conta para continuar.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(currentUrl)}`}
          className="block w-full text-center bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          Entrar para continuar
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-xl font-bold text-white mb-1">Autorizar acesso</h1>
      <p className="text-gray-500 text-xs mb-5">
        Conectado como <span className="text-gray-300">{user.email}</span>
      </p>

      <p className="text-gray-300 text-sm mb-4">
        <span className="text-white font-medium">{clientName}</span> quer permissão para:
      </p>
      <ul className="text-sm text-gray-400 space-y-2 mb-6">
        <li className="flex gap-2">
          <span aria-hidden="true">📖</span> Ler seus projetos, seções e addons
        </li>
        <li className="flex gap-2">
          <span aria-hidden="true">✏️</span> Criar e editar conteúdo nos seus GDDs
        </li>
        <li className="flex gap-2">
          <span aria-hidden="true">🗑️</span> Excluir seções e addons quando você pedir
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
            Recusar
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
            Autorizar
          </button>
        </form>
      </div>

      <p className="text-gray-600 text-xs mt-5">
        Você pode revogar esse acesso quando quiser gerando/revogando conexões em
        Configurações.
      </p>
    </Shell>
  );
}
