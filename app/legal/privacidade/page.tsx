import { legalMetadata } from "@/lib/legal/metadata";
import PrivacyPolicy from "./PrivacyPolicy";

export function generateMetadata() {
  return legalMetadata("privacidade");
}

export default function PrivacidadePage() {
  return <PrivacyPolicy />;
}
