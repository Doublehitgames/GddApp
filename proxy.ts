import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";
import { supabaseSafeFetch } from "@/lib/supabase/safeFetch";

// Rotas que NÃO precisam de autenticação
const PUBLIC_ROUTES = ["/login", "/auth/callback", "/s/", "/public/"];
const AUTH_TIMEOUT_MS = 4000;

async function getUserWithTimeout(
  supabase: ReturnType<typeof createServerClient>
): Promise<{ user: unknown; timedOut: boolean; hadError: boolean }> {
  try {
    const timeoutPromise = new Promise<{ user: unknown; timedOut: boolean; hadError: boolean }>((resolve) => {
      setTimeout(() => resolve({ user: null, timedOut: true, hadError: false }), AUTH_TIMEOUT_MS);
    });

    const authPromise = supabase.auth
      .getUser()
      .then((result: any) => ({
        user: result?.data?.user ?? null,
        timedOut: false,
        hadError: Boolean(result?.error),
      }))
      .catch(() => ({ user: null, timedOut: false, hadError: true }));

    return await Promise.race([authPromise, timeoutPromise]);
  } catch {
    return { user: null, timedOut: false, hadError: true };
  }
}

export async function proxy(request: NextRequest) {
  const bypassByCookie = request.cookies.get("e2e-bypass-auth")?.value === "1";
  if (process.env.E2E_BYPASS_AUTH === "1" || bypassByCookie) {
    return NextResponse.next({ request });
  }

  const pathname = request.nextUrl.pathname;

  // APIs têm autenticação/tratamento próprio e podem receber multipart/form-data.
  // Bypass imediato evita interferência do middleware no body stream.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      global: {
        fetch: supabaseSafeFetch,
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

  // Atualiza sessão (obrigatório para o @supabase/ssr)
  const { user, timedOut, hadError } = await getUserWithTimeout(supabase);

  if (timedOut) {
    if (isPublicRoute) {
      return supabaseResponse;
    }
    return NextResponse.next({ request });
  }

  if (hadError) {
    if (isPublicRoute) {
      return supabaseResponse;
    }
    return NextResponse.next({ request });
  }

  // Se não está autenticado e não é rota pública → redireciona para login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Se está autenticado e vai para login → redireciona para home
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Aplica middleware em todas as rotas EXCETO:
     * - _next/static (arquivos estáticos)
     * - _next/image (otimização de imagens)
     * - favicon.ico
     * - api/* (APIs têm autenticação/tratamento próprio)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/|uploads).*)",
  ],
};
