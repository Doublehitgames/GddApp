import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseUrl, getSupabasePublishableKey } from "@/lib/supabase/env";

/**
 * Rota de diagnóstico: testa conexão direta com o Supabase (fetch nativo)
 * e compara com o cliente do app. Ajuda a saber se o problema é conexão
 * ou nosso código/cliente.
 *
 * GET /api/debug-supabase-test (com sessão/cookies de usuário logado)
 * Retorna: resultado do fetch direto + resultado do cliente Supabase.
 */
export async function GET() {
  const baseUrl = getSupabaseUrl();
  const apiKey = getSupabasePublishableKey();
  const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/projects`;

  const result: {
    directFetch?: {
      status: number;
      statusText: string;
      contentType: string | null;
      bodyPreview: string;
      ok: boolean;
    };
    clientUpsert?: { success: boolean; errorMessage?: string };
    session?: { hasUser: boolean; userId?: string };
    conclusion?: string;
  } = {};

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: sessionError,
    } = await supabase.auth.getUser();

    result.session = {
      hasUser: !!user,
      userId: user?.id ?? undefined,
    };

    if (sessionError || !user) {
      return NextResponse.json(
        {
          ...result,
          conclusion: "Faça login antes de chamar esta rota. Sem sessão não dá para testar o Supabase com seu usuário.",
        },
        { status: 401 }
      );
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token ?? "";

    const testId = crypto.randomUUID();
    const now = new Date().toISOString();
    const body = {
      id: testId,
      owner_id: user.id,
      title: "debug-test-" + Date.now(),
      description: "",
      mindmap_settings: {},
      created_at: now,
      updated_at: now,
    };

    // 1) Teste com fetch direto (sem Supabase client, sem safeFetch)
    const directRes = await fetch(url, {
      method: "POST",
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(body),
    });

    let bodyPreview = "";
    try {
      const text = await directRes.text();
      bodyPreview = text.slice(0, 500);
      if (text.length > 500) bodyPreview += "...";
    } catch {
      bodyPreview = "(não foi possível ler o corpo)";
    }

    result.directFetch = {
      status: directRes.status,
      statusText: directRes.statusText,
      contentType: directRes.headers.get("content-type"),
      bodyPreview,
      ok: directRes.ok,
    };

    // Limpeza: remover projeto de teste (fetch direto DELETE)
    if (directRes.ok) {
      await fetch(`${url}?id=eq.${testId}`, {
        method: "DELETE",
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${token}`,
        },
      });
    }

    // 2) Teste com o cliente Supabase (mesmo usado no sync)
    const testId2 = crypto.randomUUID();
    const now2 = new Date().toISOString();
    const { data: upsertData, error: upsertError } = await supabase
      .from("projects")
      .upsert(
        {
          id: testId2,
          owner_id: user.id,
          title: "debug-client-" + Date.now(),
          description: "",
          mindmap_settings: {},
          created_at: now2,
          updated_at: now2,
        },
        { onConflict: "id" }
      );

    result.clientUpsert = {
      success: !upsertError,
      errorMessage: upsertError?.message,
    };

    if (!upsertError && testId2) {
      await supabase.from("projects").delete().eq("id", testId2);
    }

    // Conclusão
    if (result.directFetch.ok && result.clientUpsert?.success) {
      result.conclusion = "Conexão e cliente OK. O problema deve estar no fluxo/payload do sync.";
    } else if (result.directFetch.ok && !result.clientUpsert?.success) {
      result.conclusion =
        "Fetch direto OK, cliente falhou. Provável causa: safeFetch ou cliente Supabase (ex.: 204 tratado como erro).";
    } else if (!result.directFetch.ok) {
      result.conclusion =
        "Fetch direto falhou. Problema de conexão/URL/chave/RLS ou Supabase (projeto pausado, 502, etc.). Veja status e bodyPreview acima.";
    } else {
      result.conclusion = "Ver directFetch e clientUpsert acima.";
    }

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        ...result,
        error: message,
        conclusion: "Erro ao rodar o diagnóstico: " + message,
      },
      { status: 500 }
    );
  }
}
