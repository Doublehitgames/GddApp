import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, Math.max(0, max - 1)).trimEnd()}...`;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function toDataImageUrl(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl, { cache: "no-store" });
    if (!response.ok) return null;

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.startsWith("image/")) return null;

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > 1_500_000) return null;

    return `data:${contentType};base64,${toBase64(bytes)}`;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawTitle = (searchParams.get("title") || "GDD App").trim();
  const rawDescription = (searchParams.get("description") || "Game Design Document").trim();
  const rawShareUrl = (searchParams.get("url") || "https://gdd-app.vercel.app").trim();
  const rawIconUrl = (searchParams.get("icon") || "").trim();

  const title = truncate(rawTitle || "GDD App", 64);
  const description = truncate(rawDescription || "Game Design Document", 180);
  const shareUrl = truncate(rawShareUrl, 90);
  const iconDataUrl = rawIconUrl ? await toDataImageUrl(rawIconUrl) : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(135deg, #0f172a 0%, #111827 45%, #1f2937 100%)",
          color: "#f8fafc",
          padding: "44px",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "stretch",
            gap: "28px",
            width: "100%",
            borderRadius: "28px",
            border: "1px solid rgba(148, 163, 184, 0.28)",
            background: "linear-gradient(180deg, rgba(30, 41, 59, 0.72) 0%, rgba(17, 24, 39, 0.92) 100%)",
            padding: "34px",
          }}
        >
          <div
            style={{
              width: "182px",
              minWidth: "182px",
              borderRadius: "22px",
              border: "1px solid rgba(148, 163, 184, 0.28)",
              background: "rgba(15, 23, 42, 0.75)",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {iconDataUrl ? (
              <img
                src={iconDataUrl}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                alt="Project icon"
              />
            ) : (
              <div
                style={{
                  width: "112px",
                  height: "112px",
                  borderRadius: "22px",
                  background: "linear-gradient(135deg, #2563eb 0%, #22d3ee 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 56,
                  color: "#ffffff",
                  fontWeight: 800,
                }}
              >
                G
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              flex: 1,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  color: "#bfdbfe",
                  fontSize: 19,
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #2563eb 0%, #38bdf8 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    color: "#ffffff",
                  }}
                >
                  G
                </div>
                GDD App
              </div>
              <div
                style={{
                  color: "#94a3b8",
                  fontSize: 17,
                  fontWeight: 500,
                }}
              >
                Public Share
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  fontSize: 62,
                  lineHeight: 1,
                  fontWeight: 800,
                  color: "#f8fafc",
                  letterSpacing: "-0.02em",
                }}
              >
                {title}
              </div>
              <div
                style={{
                  fontSize: 30,
                  lineHeight: 1.2,
                  color: "#cbd5e1",
                  fontWeight: 500,
                }}
              >
                {description}
              </div>
            </div>

            <div
              style={{
                color: "#93c5fd",
                fontSize: 21,
                fontWeight: 600,
                maxWidth: "100%",
              }}
            >
              {shareUrl}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
