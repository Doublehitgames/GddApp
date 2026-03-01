"use client";

import { useAuthInit } from "@/hooks/useAuthInit";

export default function ClientInit() {
  useAuthInit();
  return null;
}
