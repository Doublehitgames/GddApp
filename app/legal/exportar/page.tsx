import { legalMetadata } from "@/lib/legal/metadata";
import { ExportarClient } from "./ExportarClient";

export function generateMetadata() {
  return legalMetadata("exportar");
}

export default function ExportarPage() {
  return <ExportarClient />;
}
