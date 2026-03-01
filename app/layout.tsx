import type { Metadata } from "next";
import "./globals.css";
import "@toast-ui/editor/dist/toastui-editor.css";
import ClientInit from "./client-init";
import SyncStatusBadge from "@/components/SyncStatusBadge";

export const metadata: Metadata = {
  title: "GDD App",
  description: "App para organizar documentos de design de jogos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>
        <ClientInit />
        <SyncStatusBadge />
        {children}
      </body>
    </html>
  );
}
