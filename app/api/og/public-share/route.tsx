import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, Math.max(0, max - 1)).trimEnd()}...`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawTitle = (searchParams.get("title") || "GDD App").trim();
  const rawDescription = (searchParams.get("description") || "Game Design Document").trim();

  const title = truncate(rawTitle || "GDD App", 80);
  const description = truncate(rawDescription || "Game Design Document", 180);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(135deg, #0f172a 0%, #111827 45%, #1f2937 100%)",
          color: "#f8fafc",
          padding: "56px",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            borderRadius: "28px",
            border: "1px solid rgba(148, 163, 184, 0.28)",
            background: "linear-gradient(180deg, rgba(30, 41, 59, 0.72) 0%, rgba(17, 24, 39, 0.92) 100%)",
            padding: "40px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                padding: "10px 16px",
                borderRadius: "999px",
                background: "rgba(59, 130, 246, 0.2)",
                border: "1px solid rgba(96, 165, 250, 0.5)",
                color: "#bfdbfe",
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #2563eb 0%, #38bdf8 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  color: "#ffffff",
                }}
              >
                G
              </div>
              GDD App
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                color: "#94a3b8",
                fontSize: 20,
                fontWeight: 600,
              }}
            >
              Public Share
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "22px", maxWidth: "92%" }}>
            <div
              style={{
                fontSize: 68,
                lineHeight: 1.02,
                fontWeight: 800,
                color: "#f8fafc",
                letterSpacing: "-0.02em",
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: 32,
                lineHeight: 1.25,
                color: "#cbd5e1",
                fontWeight: 500,
              }}
            >
              {description}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                color: "#93c5fd",
                fontSize: 24,
                fontWeight: 600,
              }}
            >
              Game Design Document
            </div>
            <div
              style={{
                display: "flex",
                color: "#94a3b8",
                fontSize: 20,
                fontWeight: 500,
              }}
            >
              gdd-app.vercel.app
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
