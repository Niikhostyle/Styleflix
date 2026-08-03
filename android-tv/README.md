# StyleFlix — APK para Android TV

App WebView a pantalla completa que abre tu Styleflix (Next.js) en la TV.

## Requisitos en la TV / red

1. Next.js corriendo (`cd netflix-clone` → `npx next dev -p 8000`)
2. La TV en la **misma WiFi**, **o** ngrok activo
3. En `app/src/main/res/values/strings.xml` la URL correcta:

```xml
<!-- Misma WiFi (mejor): -->
<string name="styleflix_url">http://192.168.1.55:8000</string>

<!-- O ngrok: -->
<string name="styleflix_url">https://unloaded-employed-twisty.ngrok-free.dev</string>
```

Tu IP local la ves al arrancar Next (`Network: http://192.168.x.x:8000`).

## Generar el APK (Android Studio)

1. Instala [Android Studio](https://developer.android.com/studio)
2. **File → Open** → carpeta `android-tv`
3. Espera a que baje el SDK / Gradle
4. **Build → Build Bundle(s) / APK(s) → Build APK(s)**
5. El archivo queda en:

`android-tv/app/build/outputs/apk/debug/app-debug.apk`

## Instalar en la TV

1. En la TV: activa **Opciones de desarrollador** → **Depuración USB** (o ADB por red)
2. Copia el APK a un USB / Drive / envíalo por ADB:

```powershell
adb connect IP_DE_TU_TV:5555
adb install -r app-debug.apk
```

O usa un instalador de APKs desde la tienda (si tu TV lo permite) y abre el archivo.

## Notas

- El control remoto (D-pad) puede ser limitado: Styleflix es web; un mando con puntero / mouse ayuda.
- Si cambias la URL de ngrok, vuelve a editar `strings.xml` y regenera el APK.
- Con `leanback` requerido, la app está pensada para **Android TV** (aparece en el launcher de TV).
