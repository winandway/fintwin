#!/usr/bin/env bash
# Compila FinTwin-<versión>.aab firmado con la llave guardada en ~/.config.
# Uso: bash build.sh            (sube appVersionCode en twa-manifest.json antes de cada versión)
set -euo pipefail
cd "$(dirname "$0")"
PROPS="$HOME/.config/windoce-hub/fintwin-upload.properties"
PASS=$(grep '^storePassword=' "$PROPS" | cut -d= -f2-)
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export BUBBLEWRAP_KEYSTORE_PASSWORD="$PASS" BUBBLEWRAP_KEY_PASSWORD="$PASS"

# 1) Regenera el proyecto Android desde twa-manifest.json.
npx -y @bubblewrap/cli@1.27.0 update --skipVersionUpgrade

# 2) Sin achicador de código: con él la app se cerraba al abrir (R8 renombra
#    clases que la librería de la ventana web busca por nombre). Es una app
#    chica; el tamaño no cambia nada.
sed -i '' 's/minifyEnabled true/minifyEnabled false/' app/build.gradle
echo "sdk.dir=$HOME/Library/Android/sdk" > local.properties

# 3) Compila y firma el .aab para Google Play.
./gradlew --no-daemon -q bundleRelease
VERSION=$(grep '"appVersionName"' twa-manifest.json | sed 's/.*: *"\(.*\)".*/\1/')
OUT="FinTwin-$VERSION.aab"
cp app/build/outputs/bundle/release/app-release.aab "$OUT"
"$JAVA_HOME/bin/jarsigner" -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore "$HOME/.config/windoce-hub/fintwin-upload.jks" -storepass "$PASS" "$OUT" fintwin-upload >/dev/null
"$JAVA_HOME/bin/jarsigner" -verify "$OUT" >/dev/null && echo "Listo: $OUT"
