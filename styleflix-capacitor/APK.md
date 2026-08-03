# StyleFlix — APK (Capacitor + Android / Android TV)

Copia del proyecto Next.js preparada para generar una APK.
La app nativa abre tu StyleFlix en WebView: `https://streaming.mublackstar.cl`

## Requisitos

1. [Android Studio](https://developer.android.com/studio) (incluye SDK + JDK)
2. Node 20+
3. StyleFlix en línea (Coolify) o una URL local/ngrok

## Generar el APK release

```powershell
cd "c:\Users\NICOLAS FIGUEROA\Documents\styleflix\netflix-clone\styleflix-capacitor"
npm install
npx cap sync android
cd android
.\gradlew.bat assembleRelease
```

Salida: `android\app\build\outputs\apk\release\app-release.apk`

Copia a la web:

`public\downloads\styleflix.apk` → `https://streaming.mublackstar.cl/descargar`

## Cambiar la URL del servidor

Edita `capacitor.config.js` → `server.url`, luego `npx cap sync android`.

- Producción: `https://streaming.mublackstar.cl`
- Local (misma WiFi): `http://192.168.x.x:3000`
