import type { CapacitorConfig } from "@capacitor/cli";

/**
 * StyleFlix (Next.js) corre en el servidor; la APK abre esa URL en WebView.
 * Cambia `server.url` si usas otro dominio o IP local.
 */
const config: CapacitorConfig = {
  appId: "cl.mublackstar.styleflix",
  appName: "StyleFlix",
  webDir: "www",
  server: {
    url: process.env.CAPACITOR_SERVER_URL || "https://streaming.mublackstar.cl",
    cleartext: true,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: true,
    backgroundColor: "#141414",
  },
};

export default config;
