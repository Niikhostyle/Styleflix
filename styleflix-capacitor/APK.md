# StyleFlix — APK (Capacitor + Android / Android TV)

Copia del proyecto Next.js preparada para generar una APK.
La app nativa abre tu StyleFlix en WebView: `https://streaming.cloudmusic.cl`

El proyecto web original sigue en `../netflix-clone` (sin tocar).

## Requisitos

1. [Android Studio](https://developer.android.com/studio) (incluye SDK + JDK)
2. Node 20+
3. StyleFlix en línea (Coolify) o una URL local/ngrok

## Generar el APK (recomendado: Android Studio)

```powershell
cd "c:\Users\NICOLAS FIGUEROA\Documents\styleflix\styleflix-capacitor"
npm install
npx cap sync android
npx cap open android
```

En Android Studio:

1. Espera a que Gradle termine
2. **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. APK debug: `android\app\build\outputs\apk\debug\app-debug.apk`

## Cambiar la URL del servidor

Edita `capacitor.config.ts` → `server.url`, luego:

```powershell
npx cap sync android
```

Ejemplos:

- Producción: `https://streaming.cloudmusic.cl`
- Local (misma WiFi): `http://192.168.x.x:3000`

## Instalar en Android TV / móvil

```powershell
adb connect IP_DE_LA_TV:5555
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

O copia el `.apk` por USB / Drive.

## APK release (para compartir)

```powershell
cd styleflix-capacitor\android
# Requiere keystore.properties + styleflix-release.jks (NO se suben a git)
.\gradlew.bat assembleRelease
```

Salida: `android\app\build\outputs\apk\release\app-release.apk`

Copia a la web para descarga fácil:

`public\downloads\styleflix.apk` → `https://streaming.cloudmusic.cl/descargar`

Guarda el `.jks` y las claves en un lugar seguro: sin ellas no podrás actualizar la misma app.

