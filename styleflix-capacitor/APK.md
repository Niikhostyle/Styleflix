# VeoTV — APKs

| Archivo en `/public/downloads/` | Dispositivo | Proyecto | Versión |
|---|---|---|---|
| `veotv-celular.apk` | Celular / tablet | `styleflix-capacitor` | 1.5.0-mobile |
| `veotv-tv.apk` | Android TV / Google TV | `android-tv` | 1.3.0-tv |

URL por defecto: `https://veotv.cloud`  
Descargas: `https://veotv.cloud/descargar`

## Celular

```powershell
cd styleflix-capacitor
npx cap sync android
cd android
.\gradlew.bat assembleRelease
New-Item -ItemType Directory -Force -Path ..\..\public\downloads | Out-Null
Copy-Item -Force app\build\outputs\apk\release\app-release.apk ..\..\public\downloads\veotv-celular.apk
```

## TV

```powershell
cd android-tv
.\gradlew.bat assembleRelease
Copy-Item -Force app\build\outputs\apk\release\app-release.apk ..\public\downloads\veotv-tv.apk
```
