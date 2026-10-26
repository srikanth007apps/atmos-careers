"use client";
import { useEffect } from "react";
import { initAnalytics } from "@/lib/firebase/client";

export function Analytics() {
  useEffect(() => {
    initAnalytics().catch(() => undefined);
  }, []);
  return null;
}
