"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  DEFAULT_MEMBERSHIP_PRICE_CLP,
  DEFAULT_RESELLER_PRICE_CLP,
  formatClp,
  type Pricing,
} from "@/lib/pricing";

const FALLBACK: Pricing = {
  membershipPriceClp: DEFAULT_MEMBERSHIP_PRICE_CLP,
  resellerPriceClp: DEFAULT_RESELLER_PRICE_CLP,
};

type PricingState = {
  pricing: Pricing;
  /** true cuando el valor viene del servidor (layout o /api/pricing), no del fallback. */
  ready: boolean;
};

const PricingContext = createContext<PricingState>({
  pricing: FALLBACK,
  ready: false,
});

/** Precio confirmado contra el servidor en esta sesión de navegador. */
let runtimePricing: Pricing | null = null;

function isValidPricing(data: unknown): data is Pricing {
  if (!data || typeof data !== "object") return false;
  const d = data as Pricing;
  return (
    typeof d.membershipPriceClp === "number" &&
    Number.isFinite(d.membershipPriceClp) &&
    d.membershipPriceClp > 0 &&
    typeof d.resellerPriceClp === "number" &&
    Number.isFinite(d.resellerPriceClp) &&
    d.resellerPriceClp > 0
  );
}

export default function PricingProvider({
  value,
  children,
}: {
  value?: Pricing;
  children: React.ReactNode;
}) {
  const hasServerValue = isValidPricing(value);
  const [state, setState] = useState<PricingState>(() => {
    if (runtimePricing) {
      return { pricing: runtimePricing, ready: true };
    }
    if (hasServerValue) {
      return { pricing: value, ready: true };
    }
    return { pricing: FALLBACK, ready: false };
  });

  const serverMembership = value?.membershipPriceClp;
  const serverReseller = value?.resellerPriceClp;

  useEffect(() => {
    if (!hasServerValue || serverMembership == null || serverReseller == null) {
      return;
    }
    const next = {
      membershipPriceClp: serverMembership,
      resellerPriceClp: serverReseller,
    };
    runtimePricing = next;
    setState({ pricing: next, ready: true });
  }, [hasServerValue, serverMembership, serverReseller]);

  // Siempre revalidamos contra /api/pricing: el layout puede haber sido
  // generado con un valor viejo; Coolify cambia MEMBERSHIP_PRICE_CLP en runtime.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/pricing", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: unknown) => {
        if (cancelled || !isValidPricing(data)) return;
        runtimePricing = data;
        setState({ pricing: data, ready: true });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PricingContext.Provider value={state}>{children}</PricingContext.Provider>
  );
}

export function usePricing(): Pricing {
  return useContext(PricingContext).pricing;
}

/** true cuando el precio ya viene del servidor (seguro para cobrar). */
export function usePricingReady(): boolean {
  return useContext(PricingContext).ready;
}

export function useMembershipPrice(): { clp: number; label: string } {
  const { membershipPriceClp } = usePricing();
  return { clp: membershipPriceClp, label: formatClp(membershipPriceClp) };
}

export function useResellerPrice(): { clp: number; label: string } {
  const { resellerPriceClp } = usePricing();
  return { clp: resellerPriceClp, label: formatClp(resellerPriceClp) };
}
