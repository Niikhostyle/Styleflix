# VeoTV — APKs

| Archivo en `/public/downloads/` | Dispositivo | Proyecto |
|---|---|---|
| `veotv-celular.apk` | Celular / tablet | `styleflix-capacitor` |
| `veotv-tv.apk` | Android TV / Google TV | `android-tv` |

URL por defecto (Coolify): `http://xm1dcyaivniukhm46fh5ic2r.207.248.200.210.sslip.io`

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
