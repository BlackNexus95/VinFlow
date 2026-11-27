#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

echo "=== Installing system packages & OpenJDK 21 ==="
sudo apt-get update -y
sudo apt-get install -y \
  curl wget unzip zip git rsync ca-certificates gnupg \
  build-essential python3 sqlite3 libsqlite3-dev \
  openjdk-21-jdk-headless

echo "=== Installing Node.js 22 LTS ==="
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v22.* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "=== Installing Android SDK Command-Line Tools ==="
ANDROID_HOME="$HOME/Android/Sdk"
CMDLINE_DIR="$ANDROID_HOME/cmdline-tools"
mkdir -p "$CMDLINE_DIR"

if [[ ! -x "$CMDLINE_DIR/latest/bin/sdkmanager" ]]; then
  TMP_ZIP="/tmp/cmdline-tools.zip"
  curl -fL "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip" -o "$TMP_ZIP"
  rm -rf /tmp/cmdline-extract "$CMDLINE_DIR/latest"
  unzip -q "$TMP_ZIP" -d /tmp/cmdline-extract
  mv /tmp/cmdline-extract/cmdline-tools "$CMDLINE_DIR/latest"
  rm -rf "$TMP_ZIP" /tmp/cmdline-extract
fi

export ANDROID_HOME
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export JAVA_HOME="/usr/lib/jvm/java-21-openjdk-amd64"
export PATH="$CMDLINE_DIR/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

cat <<'EOF' > "$HOME/.profile_finance"
export JAVA_HOME="/usr/lib/jvm/java-21-openjdk-amd64"
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
EOF

grep -q 'profile_finance' "$HOME/.bashrc" || echo 'source "$HOME/.profile_finance"' >> "$HOME/.bashrc"
grep -q 'profile_finance' "$HOME/.profile" || echo 'source "$HOME/.profile_finance"' >> "$HOME/.profile"

echo "=== Accepting Android SDK licenses & installing platform 35 + build-tools ==="
yes | sdkmanager --sdk_root="$ANDROID_HOME" --licenses >/dev/null || true
sdkmanager --sdk_root="$ANDROID_HOME" \
  "platform-tools" \
  "platforms;android-35" \
  "build-tools;35.0.0"

echo "=== Verification ==="
node -v
npm -v
java -version
javac -version
sdkmanager --list_installed | head -n 20
echo "=== Provisioning complete ==="
