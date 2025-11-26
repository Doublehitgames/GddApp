import type { Metadata } from "next";
import "./globals.css";
import ClientInit from "./client-init";

export const metadata: Metadata = {
  title: "GDD App",
  description: "App para organizar documentos de design de jogos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>
        <ClientInit />
        {children}
      </body>
    </html>
  );
}
