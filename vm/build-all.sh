#!/usr/bin/env bash
set -euo pipefail

source "$HOME/.profile_finance"

APP_DIR="/home/dev/finance"

echo "=== 1. Backend: npm install & unit tests ==="
cd "$APP_DIR/backend"
npm install
npm test

echo "=== 2. Frontend: npm install & production build ==="
cd "$APP_DIR/frontend"
npm install
npm run build

echo "=== 3. Capacitor Android: init & sync ==="
if [[ ! -d "$APP_DIR/frontend/android" ]]; then
  npx cap add android
fi
npx cap sync android

# Ensure cleartext HTTP traffic is permitted for self-hosted LAN backend URLs
MANIFEST="$APP_DIR/frontend/android/app/src/main/AndroidManifest.xml"
if ! grep -q 'usesCleartextTraffic' "$MANIFEST"; then
  sed -i 's/<application/<application android:usesCleartextTraffic="true"/' "$MANIFEST"
fi

echo "=== 4. Android Gradle: compile debug APK ==="
cd "$APP_DIR/frontend/android"
chmod +x ./gradlew
./gradlew assembleDebug --no-daemon

APK_PATH="$APP_DIR/frontend/android/app/build/outputs/apk/debug/app-debug.apk"
ls -lh "$APK_PATH"
mkdir -p "$APP_DIR/release"
cp "$APK_PATH" "$APP_DIR/release/finflow-debug.apk"

echo "=== 5. Configure systemd service for shared backend + web app ==="
sudo tee /etc/systemd/system/finance-backend.service >/dev/null <<'EOF'
[Unit]
Description=FinFlow Shared Finance Backend & Web App
After=network.target

[Service]
Type=simple
User=dev
WorkingDirectory=/home/dev/finance/backend
Environment=PORT=3001
Environment=HOST=0.0.0.0
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now finance-backend.service
sudo systemctl restart finance-backend.service
sleep 2
curl -fsS http://127.0.0.1:3001/api/health
echo ""
echo "=== Build & deployment complete! ==="
