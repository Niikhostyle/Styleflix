/**
 * VeoTV (Next.js) corre en el servidor; la APK abre esa URL en WebView.
 * Define CAPACITOR_SERVER_URL con la URL de tu Coolify antes de sync/build.
 * @type {import('@capacitor/cli').CapacitorConfig}
 */
const config = {
  appId: "cl.mublackstar.styleflix",
  appName: "VeoTV",
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

module.exports = config;
