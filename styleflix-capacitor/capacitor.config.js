/**
 * VeoTV (Next.js) corre en el servidor; la APK abre esa URL en WebView.
 * Override: CAPACITOR_SERVER_URL=https://otro-dominio
 * @type {import('@capacitor/cli').CapacitorConfig}
 */
const config = {
  appId: "cl.mublackstar.styleflix",
  appName: "VeoTV",
  webDir: "www",
  server: {
    url: process.env.CAPACITOR_SERVER_URL || "https://veotv.cloud",
    cleartext: true,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: true,
    backgroundColor: "#141414",
  },
};

module.exports = config;
