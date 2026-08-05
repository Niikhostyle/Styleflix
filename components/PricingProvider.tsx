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

const PricingContext = createContext<Pricing>(FALLBACK);

/** Precio confirmado contra el servidor en esta sesión de navegador. */
let runtimePricing: Pricing | null = null;

export default function PricingProvider({
  value,
  children,
}: {
  value?: Pricing;
  children: React.ReactNode;
}) {
  const [pricing, setPricing] = useState<Pricing>(
    runtimePricing ?? value ?? FALLBACK
  );

  const serverMembership = value?.membershipPriceClp;
  const serverReseller = value?.resellerPriceClp;

  useEffect(() => {
    if (serverMembership == null || serverReseller == null) return;
    setPricing({
      membershipPriceClp: serverMembership,
      resellerPriceClp: serverReseller,
    });
  }, [serverMembership, serverReseller]);

  // Una página prerenderizada puede traer el precio del build; lo corregimos con
  // el valor que tiene el servidor ahora mismo.
  useEffect(() => {
    if (runtimePricing) return;

    let cancelled = false;
    fetch("/api/pricing", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Pricing | null) => {
        if (cancelled || !data) return;
        if (
          typeof data.membershipPriceClp !== "number" ||
          typeof data.resellerPriceClp !== "number"
        ) {
          return;
        }
        runtimePricing = data;
        setPricing(data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PricingContext.Provider value={pricing}>{children}</PricingContext.Provider>
  );
}

export function usePricing(): Pricing {
  return useContext(PricingContext);
}

export function useMembershipPrice(): { clp: number; label: string } {
  const { membershipPriceClp } = usePricing();
  return { clp: membershipPriceClp, label: formatClp(membershipPriceClp) };
}

export function useResellerPrice(): { clp: number; label: string } {
  const { resellerPriceClp } = usePricing();
  return { clp: resellerPriceClp, label: formatClp(resellerPriceClp) };
}
