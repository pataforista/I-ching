# Guía de Publicación en Google Play Store

Esta guía explica cómo publicar **I Ching · Guía Taoísta** en Google Play usando **TWA (Trusted Web Activity)**, que empaqueta la PWA como app Android nativa.

---

## Resumen del proceso

```
PWA desplegada en Netlify
        ↓
  Bubblewrap genera el proyecto Android
        ↓
  Android Studio firma el APK/AAB
        ↓
  Google Play Console sube el bundle
        ↓
  App publicada en Play Store
```

---

## Requisitos previos

- [ ] Node.js 18+ instalado
- [ ] Java JDK 17 instalado (`java -version`)
- [ ] Android SDK instalado (o Android Studio)
- [ ] Cuenta de Google Play Console ($25 USD, pago único)
- [ ] La PWA desplegada en Netlify (URL: `https://i-ching-taoista.netlify.app`)

---

## Paso 1 — Preparar la PWA

La PWA ya cumple todos los requisitos TWA:
- [x] HTTPS (Netlify)
- [x] Service Worker con soporte offline
- [x] `manifest.webmanifest` con iconos y scope
- [x] Política de privacidad en `/privacy.html`
- [x] Icono 512x512 PNG + maskable
- [x] Display mode: `standalone`

**Acción necesaria:** Reemplazar los placeholders en `assets/screenshots/` con capturas reales de la app:
```
assets/screenshots/screen-home.png      → 1080x1920 captura de pantalla real
assets/screenshots/screen-reading.png   → 1080x1920 captura de pantalla real
assets/screenshots/feature-graphic.png  → 1024x500 gráfico destacado
```
Puedes regenerar los placeholders con: `npm run generate-screenshots`

---

## Paso 2 — Instalar Bubblewrap CLI

```bash
npm install -g @bubblewrap/cli
bubblewrap --version
```

---

## Paso 3 — Generar el keystore (firma de la app)

**Solo la primera vez.** El keystore es tu identidad como desarrollador. **No lo pierdas.**

```bash
keytool -genkeypair \
  -v \
  -keystore android.keystore \
  -alias iching-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass TU_CONTRASEÑA_AQUI \
  -keypass TU_CONTRASEÑA_AQUI \
  -dname "CN=IChing Taoista, OU=App, O=IChing Taoista, L=Mexico, S=Mexico, C=MX"
```

> ⚠️ Guarda `android.keystore` y las contraseñas en un lugar seguro. Si lo pierdes, no podrás publicar actualizaciones de la app.

---

## Paso 4 — Obtener el SHA-256 del keystore

```bash
keytool -list -v -keystore android.keystore -alias iching-key
```

Busca la línea `SHA256:` y copia el fingerprint. Tiene el formato:
```
AB:CD:EF:12:34:...
```

---

## Paso 5 — Actualizar assetlinks.json

Edita `.well-known/assetlinks.json` y reemplaza el placeholder con el SHA-256 real:

```json
[
    {
        "relation": ["delegate_permission/common.handle_all_urls"],
        "target": {
            "namespace": "android_app",
            "package_name": "com.iching.taoista",
            "sha256_cert_fingerprints": [
                "TU_SHA256_AQUI"
            ]
        }
    }
]
```

Luego **sube este cambio a Netlify** (push a main/master). El archivo debe ser accesible en:
```
https://i-ching-taoista.netlify.app/.well-known/assetlinks.json
```

**Verificar:**
```bash
curl https://i-ching-taoista.netlify.app/.well-known/assetlinks.json
```

---

## Paso 6 — Generar el proyecto Android con Bubblewrap

```bash
# En la raíz del proyecto (donde está twa-manifest.json)
bubblewrap build
```

Si es la primera vez, Bubblewrap pedirá instalar el JDK y Android SDK automáticamente.

También puedes inicializar desde el manifest:
```bash
bubblewrap init --manifest https://i-ching-taoista.netlify.app/manifest.webmanifest
```

Esto genera la carpeta `android/` con el proyecto Android completo.

---

## Paso 7 — Firmar y construir el AAB

```bash
# Construir el Android App Bundle (formato requerido por Play Store)
bubblewrap build

# El archivo resultante estará en:
# android/app/build/outputs/bundle/release/app-release.aab
```

Si prefieres usar Gradle directamente:
```bash
cd android
./gradlew bundleRelease
```

---

## Paso 8 — Subir a Google Play Console

1. Ve a [play.google.com/console](https://play.google.com/console)
2. **Crear nueva app** → Selecciona: App / Gratis / Español
3. En **Versiones → Producción → Crear nueva versión:**
   - Sube el archivo `app-release.aab`
   - Agrega las notas de versión (en `store-listing.json → release_notes`)
4. Completa el **Listing de la tienda** con los textos de `store-listing.json`
5. Sube las capturas de pantalla de `assets/screenshots/`
6. Completa el cuestionario de **Contenido** (clasificación de edad)
7. Completa la sección **Precios y distribución**
8. Crea el **producto de compra** en Play → Monetización → Productos:
   - Product ID: `iching_reflection_plus`
   - Tipo: Compra única
   - Precio: $129 MXN (o el que definas)

---

## Paso 9 — Verificar la integración TWA

Una vez publicada la app y con el `assetlinks.json` correcto, la app no mostrará la barra de URL del navegador (funciona como app nativa). Para verificar:

```bash
# Digital Asset Links verification
curl "https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://i-ching-taoista.netlify.app&relation=delegate_permission/common.handle_all_urls"
```

Debe responder con el package name de la app.

---

## Paso 10 — Publicar actualizaciones

Para cada actualización:
1. Incrementa `appVersionCode` en `twa-manifest.json` (ej: 2 → 3)
2. Incrementa `appVersion` (ej: 0.1.3 → 0.1.4)
3. Ejecuta `bubblewrap build`
4. Sube el nuevo AAB a Play Console

---

## Archivos de configuración clave

| Archivo | Propósito |
|---------|-----------|
| `twa-manifest.json` | Config de Bubblewrap para generar el proyecto Android |
| `manifest.webmanifest` | Manifest PWA (título, iconos, scope, shortcuts) |
| `.well-known/assetlinks.json` | Vincula el dominio con el package Android |
| `store-listing.json` | Metadatos del listing en Play Store |
| `assets/screenshots/` | Capturas para Play Store (reemplazar placeholders) |
| `data/products.json` | Definición de productos in-app |
| `privacy.html` | Política de privacidad (requerida por Play Store) |

---

## Checklist final antes de publicar

- [ ] `assetlinks.json` tiene el SHA-256 real del keystore
- [ ] `assetlinks.json` está accesible en la URL de Netlify
- [ ] Screenshots reales en `assets/screenshots/` (no placeholders)
- [ ] `store-listing.json → contact.email` tiene tu email real
- [ ] Privacy policy URL responde con 200 en Netlify
- [ ] `bubblewrap build` completó sin errores
- [ ] App probada en dispositivo físico Android antes de publicar

---

## Recursos

- [Bubblewrap CLI](https://github.com/GoogleChromeLabs/bubblewrap)
- [TWA Documentation](https://developer.chrome.com/docs/android/trusted-web-activity)
- [Play Console Help](https://support.google.com/googleplay/android-developer)
- [Digital Asset Links](https://developers.google.com/digital-asset-links)
- [PWA Checklist](https://web.dev/pwa-checklist/)
