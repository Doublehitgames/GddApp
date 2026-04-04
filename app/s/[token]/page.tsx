import GDDViewClient from "@/app/projects/[id]/view/GDDViewClient";
import MindMapClient from "@/app/projects/[id]/mindmap/MindMapClient";
import DiagramasClient from "@/app/projects/[id]/diagramas/DiagramasClient";
import { getPublicProjectByToken } from "@/lib/supabase/publicShare";
import { cache } from "react";
import type { Metadata } from "next";

const getPublicProjectByTokenCached = cache(async (token: string) => getPublicProjectByToken(token));

const FALLBACK_SITE_URL = "https://gdd-app.vercel.app";

function getSiteUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  return fromEnv || FALLBACK_SITE_URL;
}

function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function getSpotlightTitleIconUrl(project: unknown): string | null {
  if (!project || typeof project !== "object") return null;
  const raw = project as { mindMapSettings?: { documentView?: { spotlight?: { titleIconUrl?: unknown } } } };
  const maybe = raw.mindMapSettings?.documentView?.spotlight?.titleIconUrl;
  return typeof maybe === "string" && maybe.trim() ? maybe.trim() : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const project = await getPublicProjectByTokenCached(token);
  const siteUrl = getSiteUrl();
  const shareUrl = `${siteUrl}/s/${encodeURIComponent(token)}`;

  if (!project) {
    const fallbackTitle = "GDD compartilhado | GDD App";
    const fallbackDescription = "Visualize um Game Design Document compartilhado no GDD App.";
    const fallbackImage = `${siteUrl}/api/og/public-share?title=${encodeURIComponent("GDD App")}&description=${encodeURIComponent("Game Design Document")}`;

    return {
      title: fallbackTitle,
      description: fallbackDescription,
      openGraph: {
        title: fallbackTitle,
        description: fallbackDescription,
        type: "website",
        url: shareUrl,
        images: [{ url: fallbackImage, width: 1200, height: 630, alt: "GDD App" }],
      },
      twitter: {
        card: "summary_large_image",
        title: fallbackTitle,
        description: fallbackDescription,
        images: [fallbackImage],
      },
    };
  }

  const title = truncate(`${project.title} | GDD App`, 90);
  const description = truncate(`GDD do jogo ${project.title}.`, 180);
  const version = encodeURIComponent(project.updatedAt || project.createdAt || "v1");
  const spotlightTitleIconUrl = getSpotlightTitleIconUrl(project);
  const imageUrl = `${siteUrl}/api/og/public-share?title=${encodeURIComponent(project.title)}&description=${encodeURIComponent(description)}&url=${encodeURIComponent(shareUrl)}${spotlightTitleIconUrl ? `&icon=${encodeURIComponent(spotlightTitleIconUrl)}` : ""}&v=${version}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: shareUrl,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: `${project.title} - GDD App` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function PublicSharePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ mode?: string; sectionId?: string }>;
}) {
  const { token } = await params;
  const { mode, sectionId } = await searchParams;

  const project = await getPublicProjectByTokenCached(token);
  if (!project) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <p className="text-gray-700">Link público inválido ou expirado.</p>
      </div>
    );
  }

  const isMindMapMode = mode === "mindmap";
  const isDiagramMode = mode === "diagramas";

  if (isMindMapMode) {
    return <MindMapClient projectId={project.id} publicToken={token} />;
  }

  if (isDiagramMode) {
    const requestedSection = sectionId
      ? project.sections?.find((section) => section.id === sectionId)
      : undefined;
    const fallbackSection = project.sections?.find((section) => Boolean(section.flowchartEnabled));
    const targetSection = requestedSection && requestedSection.flowchartEnabled
      ? requestedSection
      : fallbackSection;

    if (!targetSection) {
      return <GDDViewClient projectId={project.id} publicToken={token} />;
    }

    return (
      <DiagramasClient
        projectId={project.id}
        sectionId={targetSection.id}
        publicToken={token}
        publicProjectTitle={project.title}
        publicSectionTitle={targetSection.title}
        initialDiagramState={targetSection.flowchartState}
        readOnlyPublic
      />
    );
  }

  return <GDDViewClient projectId={project.id} publicToken={token} />;
}
