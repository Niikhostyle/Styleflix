# Naseros — APKs

| Archivo en `/public/downloads/` | Dispositivo | Proyecto |
|---|---|---|
| `styleflix-celular.apk` | Celular / tablet | `styleflix-capacitor` (appName: Naseros) |
| `styleflix-tv.apk` | Android TV / Google TV | `android-tv` |

Ambos abren la URL de tu Coolify (`CAPACITOR_SERVER_URL` / `styleflix_url`).

## Celular

```bash
cd styleflix-capacitor
# set CAPACITOR_SERVER_URL=https://TU-COOLIFY
npx cap sync android
cd android && .\gradlew.bat assembleRelease
Copy-Item -Force app\build\outputs\apk\release\app-release.apk ..\..\public\downloads\styleflix-celular.apk
```

## TV

```bash
cd android-tv
# edita res/values/strings.xml → styleflix_url
.\gradlew.bat assembleRelease
Copy-Item -Force app\build\outputs\apk\release\app-release.apk ..\public\downloads\styleflix-tv.apk
```
