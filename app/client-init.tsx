"use client";

import { useAuthInit } from "@/hooks/useAuthInit";
import SyncStatusBadge from "@/components/SyncStatusBadge";

export default function ClientInit() {
  useAuthInit();
  return <SyncStatusBadge />;
}
