#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run with sudo: sudo ./install-gateway.sh"
  exit 1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

apt-get update
apt-get install -y adb nodejs

install -d -o ubuntu -g ubuntu /opt/pocketdock/gateway/src
install -m 0644 "${repo_root}/apps/gateway/package.json" /opt/pocketdock/gateway/package.json
install -m 0644 "${repo_root}/apps/gateway/src/server.mjs" /opt/pocketdock/gateway/src/server.mjs

install -d -m 0750 /etc/pocketdock
if [[ ! -f /etc/pocketdock/gateway.env ]]; then
  install -m 0640 "${repo_root}/infra/oracle/gateway.env.example" /etc/pocketdock/gateway.env
fi

install -m 0644 "${repo_root}/infra/oracle/pocketdock-gateway.service" /etc/systemd/system/pocketdock-gateway.service
systemctl daemon-reload
systemctl enable pocketdock-gateway.service

echo "Gateway installed. Edit /etc/pocketdock/gateway.env before starting it."
echo "Then run: sudo systemctl start pocketdock-gateway"

