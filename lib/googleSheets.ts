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
 * Converts a zero-based column index to a spreadsheet column letter.
 * 0 → "A", 1 → "B", 25 → "Z", 26 → "AA", etc.
 */
export function columnIndexToLetter(index: number): string {
  let result = "";
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

/**
 * Converts a spreadsheet column letter to a zero-based column index.
 * "A" → 0, "B" → 1, "Z" → 25, "AA" → 26, etc.
 */
function columnLetterToIndex(letter: string): number {
  let index = 0;
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.toUpperCase().charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Fetches the first row (headers) for each given sheet tab.
 * Returns a map of sheetName → full-width header array (index = 0-based column index).
 *
 * IMPORTANT: empty strings are preserved so that array index === column index.
 * The Google Sheets API omits leading empty cells from the response but tells us
 * the actual starting column in `response.range` (e.g. "Sheet1!B1:F1").
 * We prepend empty strings for any skipped leading columns so that
 * headers[0] → column A, headers[1] → column B, etc.
 * Dropdowns should filter empty strings for display but use the full array for index lookups.
 */
export async function fetchSpreadsheetHeaders(
  token: string,
  spreadsheetId: string,
  sheetNames: string[],
): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};
  await Promise.all(
    sheetNames.map(async (sheetName) => {
      const range = `${sheetName}!1:1`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;
      try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const data = (await res.json()) as { range?: string; values?: string[][] };
        // Determine the 0-based column index where the API response starts.
        // The response `range` field looks like "Sheet1!B1:F1" when A1 is empty.
        const startColLetter = data.range?.match(/!([A-Z]+)\d*:/)?.[1] ?? "A";
        const startOffset = columnLetterToIndex(startColLetter);
        // Prepend empty strings for skipped leading columns so index === column index.
        const rawRow = (data.values?.[0] ?? []).map((h) => String(h ?? "").trim());
        const headers = [...Array(startOffset).fill(""), ...rawRow];
        if (headers.some(Boolean)) result[sheetName] = headers;
      } catch {
        // silently skip tabs that fail
      }
    })
  );
  return result;
}

/**
 * Fetches all values from column A of a sheet tab (used for row lock resolution).
 * Returns the raw string values of each cell, index 0 = row 1.
 */
export async function fetchColumnValues(
  token: string,
  spreadsheetId: string,
  sheetName: string,
): Promise<string[] | null> {
  const range = `${sheetName}!A:A`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const data = (await res.json()) as { values?: string[][] };
    return (data.values ?? []).map((row) => String(row[0] ?? "").trim());
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
