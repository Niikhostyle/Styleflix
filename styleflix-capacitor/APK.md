# StyleFlix — APKs

Hay **dos** APKs:

| Archivo | Destino | Proyecto |
|---------|---------|----------|
| `styleflix-celular.apk` | Celular / tablet | `styleflix-capacitor` |
| `styleflix-tv.apk` | Android TV / Google TV | `android-tv` |

Ambos abren: `https://streaming.mublackstar.cl`

Descarga pública: `https://streaming.mublackstar.cl/descargar`

## Build celular (Capacitor)

```powershell
cd "c:\Users\NICOLAS FIGUEROA\Documents\styleflix\netflix-clone\styleflix-capacitor"
npm install
npx cap sync android
cd android
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.12.8-hotspot"
.\gradlew.bat assembleRelease
Copy-Item -Force app\build\outputs\apk\release\app-release.apk ..\..\public\downloads\styleflix-celular.apk
```

## Build TV (android-tv)

Requiere `android-tv\keystore.properties` + `styleflix-release.jks` (copiar desde Capacitor; no van a git).

```powershell
cd "c:\Users\NICOLAS FIGUEROA\Documents\styleflix\netflix-clone\android-tv"
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.12.8-hotspot"
.\gradlew.bat assembleRelease
Copy-Item -Force app\build\outputs\apk\release\app-release.apk ..\public\downloads\styleflix-tv.apk
```
