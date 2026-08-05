"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
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
  /** true cuando el valor viene del servidor (layout o /api/pricing). */
  ready: boolean;
  refreshPricing: () => Promise<void>;
};

const PricingContext = createContext<PricingState>({
  pricing: FALLBACK,
  ready: false,
  refreshPricing: async () => {},
});

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
  const [pricing, setPricing] = useState<Pricing>(
    hasServerValue ? value : FALLBACK
  );
  const [ready, setReady] = useState(hasServerValue);

  const applyPricing = useCallback((data: Pricing) => {
    setPricing(data);
    setReady(true);
  }, []);

  const refreshPricing = useCallback(async () => {
    try {
      const res = await fetch("/api/pricing", { cache: "no-store" });
      if (!res.ok) return;
      const data: unknown = await res.json();
      if (isValidPricing(data)) applyPricing(data);
    } catch {
      /* keep current */
    }
  }, [applyPricing]);

  useEffect(() => {
    if (!hasServerValue || !value) return;
    applyPricing(value);
  }, [hasServerValue, value, applyPricing]);

  useEffect(() => {
    void refreshPricing();
  }, [refreshPricing]);

  return (
    <PricingContext.Provider value={{ pricing, ready, refreshPricing }}>
      {children}
    </PricingContext.Provider>
  );
}

export function usePricing(): Pricing {
  return useContext(PricingContext).pricing;
}

export function usePricingReady(): boolean {
  return useContext(PricingContext).ready;
}

export function useRefreshPricing(): () => Promise<void> {
  return useContext(PricingContext).refreshPricing;
}

export function useMembershipPrice(): { clp: number; label: string } {
  const { membershipPriceClp } = usePricing();
  return { clp: membershipPriceClp, label: formatClp(membershipPriceClp) };
}

export function useResellerPrice(): { clp: number; label: string } {
  const { resellerPriceClp } = usePricing();
  return { clp: resellerPriceClp, label: formatClp(resellerPriceClp) };
}
