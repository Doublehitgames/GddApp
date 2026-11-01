import { legalMetadata } from "@/lib/legal/metadata";
import { TermsClient } from "./TermsClient";

export function generateMetadata() {
  return legalMetadata("termos");
}

export default function TermsPage() {
  return <TermsClient />;
}
