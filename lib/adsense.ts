export type AdSenseConfig = {
  clientId: string | null;
  slotHome: string | null;
  slotDetail: string | null;
};

export function getAdSenseConfig(): AdSenseConfig {
  return {
    clientId: process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim() || null,
    slotHome: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME?.trim() || null,
    slotDetail: process.env.NEXT_PUBLIC_ADSENSE_SLOT_DETAIL?.trim() || null,
  };
}
