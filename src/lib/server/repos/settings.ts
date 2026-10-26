import "server-only";
import type { AppSettings } from "@/lib/types";
import { adminDb } from "../firebase-admin";

export const DEFAULT_SETTINGS: AppSettings = {
  notifications: { sendAcknowledgement: false, sendStatusUpdates: false },
};

export async function getSettings(): Promise<AppSettings> {
  const snap = await (await adminDb()).ref("settings").get();
  const v = (snap.val() ?? {}) as Partial<AppSettings>;
  return { notifications: { ...DEFAULT_SETTINGS.notifications, ...(v.notifications ?? {}) } };
}

export async function updateSettings(settings: AppSettings) {
  await (await adminDb()).ref("settings").set({ ...settings, updatedAt: Date.now() });
}
