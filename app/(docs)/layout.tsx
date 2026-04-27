import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentação · GDD Manager",
  description:
    "Como usar o GDD Manager para organizar Game Design Documents — addons, page types, Remote Config, AI e integrações.",
};

export default function DocsRootLayout({ children }: { children: ReactNode }) {
  return children;
}
