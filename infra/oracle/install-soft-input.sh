#!/usr/bin/env bash
set -euo pipefail

FRIDA_VERSION="${FRIDA_VERSION:-17.16.0}"
ADB_SERIAL="${ADB_SERIAL:-127.0.0.1:5555}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="/opt/pocketdock/frida"
SERVER="${INSTALL_DIR}/frida-server-${FRIDA_VERSION}"

if [[ "$(uname -m)" != "aarch64" ]]; then
  echo "This installer expects the Oracle ARM64 instance." >&2
  exit 1
fi

sudo install -d -m 0755 "${INSTALL_DIR}"
if [[ ! -x "${SERVER}" ]]; then
  curl -fL \
    "https://github.com/frida/frida/releases/download/${FRIDA_VERSION}/frida-server-${FRIDA_VERSION}-android-arm64.xz" \
    -o /tmp/frida-server.xz
  xz -dkf /tmp/frida-server.xz
  sudo install -m 0755 /tmp/frida-server "${SERVER}"
fi

sudo python3 -m venv "${INSTALL_DIR}/venv"
sudo "${INSTALL_DIR}/venv/bin/pip" install \
  --disable-pip-version-check \
  "frida==${FRIDA_VERSION}" \
  frida-tools

sudo install -m 0644 "${SCRIPT_DIR}/android-soft-input.js" \
  "${INSTALL_DIR}/android-soft-input.js"
sudo install -m 0755 "${SCRIPT_DIR}/keep-android-soft-input.py" \
  "${INSTALL_DIR}/keep-android-soft-input.py"
sudo install -m 0644 "${SCRIPT_DIR}/pocketdock-soft-input.service" \
  /etc/systemd/system/pocketdock-soft-input.service

adb -s "${ADB_SERIAL}" root
sleep 2
adb connect "${ADB_SERIAL}" >/dev/null
adb -s "${ADB_SERIAL}" push "${SERVER}" /data/local/tmp/frida-server >/dev/null
adb -s "${ADB_SERIAL}" shell chmod 0755 /data/local/tmp/frida-server

sudo systemctl daemon-reload
sudo systemctl enable --now pocketdock-soft-input.service
sudo systemctl --no-pager status pocketdock-soft-input.service
