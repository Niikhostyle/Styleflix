import { prisma } from "@/lib/prisma";

export const PREVIEW_MINUTES_KEY = "previewMinutes";
export const DEFAULT_PREVIEW_MINUTES = 5;

export async function getPreviewMinutes(): Promise<number> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: PREVIEW_MINUTES_KEY },
    });
    const n = Number(row?.value ?? DEFAULT_PREVIEW_MINUTES);
    if (!Number.isFinite(n) || n < 1) return DEFAULT_PREVIEW_MINUTES;
    return Math.min(180, Math.floor(n));
  } catch (err) {
    console.warn("[settings] getPreviewMinutes", err);
    return DEFAULT_PREVIEW_MINUTES;
  }
}

export async function setPreviewMinutes(minutes: number): Promise<number> {
  const value = Math.min(180, Math.max(1, Math.floor(minutes)));
  await prisma.appSetting.upsert({
    where: { key: PREVIEW_MINUTES_KEY },
    create: { key: PREVIEW_MINUTES_KEY, value: String(value) },
    update: { value: String(value) },
  });
  return value;
}
