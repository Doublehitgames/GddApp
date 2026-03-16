import { NextResponse } from "next/server";

/**
 * Configuração pública para o client (sem auth).
 * Usado para obter NEXT_PUBLIC_GOOGLE_CLIENT_ID em runtime quando não foi
 * incluído no build (ex.: variável adicionada no Vercel após o último deploy).
 */
export async function GET() {
  const googleClientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || null;
  return NextResponse.json({ googleClientId });
}
