import { legalMetadata } from "@/lib/legal/metadata";
import EsquecimentoClient from "./EsquecimentoClient";

export function generateMetadata() {
  return legalMetadata("esquecimento");
}

export default function LegalEsquecimentoPage() {
  return <EsquecimentoClient />;
}
