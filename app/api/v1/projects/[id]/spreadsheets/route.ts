import { NextRequest } from "next/server";
import {
  requireAuth,
  requireProject,
  apiJson,
} from "@/lib/api/v1/helpers";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/projects/:id/spreadsheets — the project's linked Google
 * Spreadsheet registry (id/UUID, name, url, sheets/tabs, and column headers
 * per sheet). Lean alternative to the full project GET when an agent only
 * needs the spreadsheet metadata to build field bindings.
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const result = await requireAuth(request);
  if ("response" in result) return result.response;
  const { auth } = result;

  const pResult = await requireProject(auth.supabase, id, auth.userId);
  if ("response" in pResult) return pResult.response;

  const raw = pResult.project.linked_spreadsheets;
  const linkedSpreadsheets = Array.isArray(raw) ? raw : [];

  return apiJson(linkedSpreadsheets);
}
