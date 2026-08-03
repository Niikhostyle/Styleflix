/**
 * StyleFlix (Next.js) corre en el servidor; la APK abre esa URL en WebView.
 * Cambia `server.url` si usas otro dominio o IP local.
 * @type {import('@capacitor/cli').CapacitorConfig}
 */
const config = {
  appId: "cl.mublackstar.styleflix",
  appName: "StyleFlix",
  webDir: "www",
  server: {
    url: process.env.CAPACITOR_SERVER_URL || "https://streaming.cloudmusic.cl",
    cleartext: true,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: true,
    backgroundColor: "#141414",
  },
};

module.exports = config;
