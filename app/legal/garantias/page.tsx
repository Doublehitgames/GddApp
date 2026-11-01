import { legalMetadata } from "@/lib/legal/metadata";
import { GarantiasClient } from "./GarantiasClient";

export function generateMetadata() {
  return legalMetadata("garantias");
}

export default function GarantiasPage() {
  return <GarantiasClient />;
}
