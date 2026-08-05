import { prisma } from "@/lib/prisma";
import {
  DEFAULT_MEMBERSHIP_PRICE_CLP,
  DEFAULT_RESELLER_PRICE_CLP,
  envMembershipPriceClp,
  envResellerPriceClp,
  parsePriceClp,
  type Pricing,
} from "@/lib/pricing";

export const PREVIEW_MINUTES_KEY = "previewMinutes";
export const MEMBERSHIP_PRICE_KEY = "membershipPriceClp";
export const RESELLER_PRICE_KEY = "resellerPriceClp";

export const DEFAULT_PREVIEW_MINUTES = 5;

const MIN_PRICE_CLP = 1;
const MAX_PRICE_CLP = 1_000_000;

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

function clampPriceClp(n: number): number {
  return Math.min(MAX_PRICE_CLP, Math.max(MIN_PRICE_CLP, Math.round(n)));
}

async function readPriceSetting(
  key: string,
  fallback: number
): Promise<number> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key } });
    if (!row?.value?.trim()) return fallback;
    return parsePriceClp(row.value, fallback);
  } catch (err) {
    console.warn(`[settings] readPriceSetting(${key})`, err);
    return fallback;
  }
}

/** Precio efectivo: DB (admin) → env → default. */
export async function getMembershipPriceClp(): Promise<number> {
  return readPriceSetting(MEMBERSHIP_PRICE_KEY, envMembershipPriceClp());
}

export async function getResellerPriceClp(): Promise<number> {
  return readPriceSetting(RESELLER_PRICE_KEY, envResellerPriceClp());
}

export async function getPricing(): Promise<Pricing> {
  const [membershipPriceClp, resellerPriceClp] = await Promise.all([
    getMembershipPriceClp(),
    getResellerPriceClp(),
  ]);
  return { membershipPriceClp, resellerPriceClp };
}

export async function setMembershipPriceClp(amount: number): Promise<number> {
  const value = clampPriceClp(amount);
  await prisma.appSetting.upsert({
    where: { key: MEMBERSHIP_PRICE_KEY },
    create: { key: MEMBERSHIP_PRICE_KEY, value: String(value) },
    update: { value: String(value) },
  });
  return value;
}

export async function setResellerPriceClp(amount: number): Promise<number> {
  const value = clampPriceClp(amount);
  await prisma.appSetting.upsert({
    where: { key: RESELLER_PRICE_KEY },
    create: { key: RESELLER_PRICE_KEY, value: String(value) },
    update: { value: String(value) },
  });
  return value;
}

export async function setPricing(input: {
  membershipPriceClp: number;
  resellerPriceClp: number;
}): Promise<Pricing> {
  const [membershipPriceClp, resellerPriceClp] = await Promise.all([
    setMembershipPriceClp(input.membershipPriceClp),
    setResellerPriceClp(input.resellerPriceClp),
  ]);
  return { membershipPriceClp, resellerPriceClp };
}

/** Defaults de código (sin DB ni env); útil para docs. */
export const PRICING_CODE_DEFAULTS = {
  membershipPriceClp: DEFAULT_MEMBERSHIP_PRICE_CLP,
  resellerPriceClp: DEFAULT_RESELLER_PRICE_CLP,
} as const;
