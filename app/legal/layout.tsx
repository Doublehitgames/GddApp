import type { ReactNode } from "react";
import { legalMetadata } from "@/lib/legal/metadata";
import { LegalShell } from "@/components/legal/LegalShell";

// Título da aba no idioma de quem lê; cada página /legal/<slug> troca pelo dela.
export function generateMetadata() {
  return legalMetadata();
}

export default function LegalLayout({ children }: { children: ReactNode }) {
  return <LegalShell>{children}</LegalShell>;
}
