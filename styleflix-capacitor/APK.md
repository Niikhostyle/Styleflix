# StyleFlix — APK (Capacitor + Android / Android TV)

Copia del proyecto Next.js preparada para generar una APK.
La app nativa abre tu StyleFlix en WebView: `https://streaming.mublackstar.cl`

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

- Producción: `https://streaming.mublackstar.cl`
- Local (misma WiFi): `http://192.168.x.x:3000`

## Instalar en Android TV / móvil

```powershell
adb connect IP_DE_LA_TV:5555
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

O copia el `.apk` por USB / Drive.

## Bloqueo de publicidad (APK)

La APK usa un **filtro de red en el WebView** (misma idea que Brave): corta peticiones a
DoubleClick, Google IMA, AdSense, VAST, etc. Sin tocar `vimeus.com`.

En el navegador de escritorio/móvil **sin** Brave/uBlock, Chrome no puede bloquear ads
dentro del iframe de Vimeus (limitación del navegador). Usa la APK o Brave.

Tras cambiar el bloqueador:

```powershell
cd styleflix-capacitor\android
.\gradlew.bat assembleDebug
```

