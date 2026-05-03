/**
 * Google Sheets integration: OAuth token + cell value fetch.
 * Uses the same GSI (Google Sign-In) script pattern as googleDrivePicker.ts.
 * Scope: spreadsheets.readonly — only reads, never writes.
 */

const SCRIPT_GSI = "https://accounts.google.com/gsi/client";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

// In-memory token cache so consecutive syncs in the same session don't re-prompt.
let cachedToken: string | null = null;
let cachedTokenExpiry = 0;

/**
 * Requests a Google OAuth access token with spreadsheets.readonly scope.
 * Prompts the user on first call; silent on subsequent calls while token is valid.
 */
export async function getGoogleSheetsToken(clientId: string): Promise<string | null> {
  if (cachedToken && Date.now() < cachedTokenExpiry) {
    return cachedToken;
  }

  await loadScript(SCRIPT_GSI);

  return new Promise((resolve) => {
    const google = (window as unknown as { google?: { accounts?: { oauth2?: { initTokenClient: (c: unknown) => { requestAccessToken: (o?: unknown) => void } } } } }).google;
    if (!google?.accounts?.oauth2) {
      resolve(null);
      return;
    }

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SHEETS_SCOPE,
      callback: (response: { access_token?: string; expires_in?: number; error?: string }) => {
        if (response.error || !response.access_token) {
          resolve(null);
          return;
        }
        cachedToken = response.access_token;
        // expires_in is in seconds; subtract 60s buffer
        cachedTokenExpiry = Date.now() + ((response.expires_in ?? 3600) - 60) * 1000;
        resolve(response.access_token);
      },
    });

    tokenClient.requestAccessToken({ prompt: "" });
  });
}

/**
 * Extracts the spreadsheet ID from a full Google Sheets URL or returns the value as-is
 * if it looks like a plain ID already.
 * e.g. https://docs.google.com/spreadsheets/d/ABC123/edit#gid=0 → "ABC123"
 */
export function parseSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];

  // Looks like a raw ID (no slashes, reasonable length)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;

  return null;
}

/**
 * Fetches the value of a single cell from Google Sheets API v4.
 * Returns the raw string value, or null on error.
 */
export async function fetchSheetCellValue(
  token: string,
  spreadsheetId: string,
  sheetName: string,
  cellRef: string,
): Promise<string | null> {
  const range = sheetName ? `${sheetName}!${cellRef}` : cellRef;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { values?: string[][] };
    return data.values?.[0]?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns the list of sheet (tab) names for a given spreadsheet.
 * Uses the spreadsheets.get endpoint with fields=sheets.properties.title.
 */
export async function fetchSpreadsheetSheets(
  token: string,
  spreadsheetId: string,
): Promise<string[] | null> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { sheets?: Array<{ properties?: { title?: string } }> };
    return (data.sheets ?? [])
      .map((s) => s.properties?.title ?? "")
      .filter(Boolean);
  } catch {
    return null;
  }
}

/**
 * Fetches all values from a column range in a Google Sheet.
 * Range format: "B2:B51" — returns one value per row in the range.
 * Returns null if the request fails.
 */
export async function fetchSheetRangeValues(
  token: string,
  spreadsheetId: string,
  sheetName: string,
  range: string
): Promise<(string | number | null)[] | null> {
  const fullRange = `${sheetName}!${range}`;
  const encodedRange = encodeURIComponent(fullRange);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodedRange}`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const data = await res.json();
    // data.values: array of rows; each row is an array of cell values
    const rawRows: unknown[][] = data.values ?? [];
    // For a column range, each row has one element (the cell value)
    return rawRows.map((row) => {
      const cell = Array.isArray(row) ? row[0] : undefined;
      if (cell == null || cell === "") return null;
      return cell as string | number;
    });
  } catch {
    return null;
  }
}

/**
 * Parses a raw cell string value to a number.
 * Handles values like "150", "1,500", "1.500,00" (pt-BR) etc.
 */
export function parseCellNumber(raw: string): number | null {
  if (!raw || typeof raw !== "string") return null;
  // Remove currency symbols, spaces
  let cleaned = raw.replace(/[^\d.,\-]/g, "").trim();
  if (!cleaned) return null;

  // pt-BR format: 1.500,00 → remove dots, replace comma with dot
  if (/\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    // en-US: 1,500.00 → remove commas
    cleaned = cleaned.replace(/,/g, "");
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}
