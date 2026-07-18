#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="${CONTAINER_NAME:-pocketdock-android-01}"
IMAGE="${IMAGE:-redroid/redroid:12.0.0_64only-latest}"
DATA_DIR="${DATA_DIR:-/opt/pocketdock/data/android-01}"

sudo install -d -m 0755 "${DATA_DIR}"

if ! lsmod | grep -q '^binder_linux'; then
  sudo modprobe binder_linux devices=binder,hwbinder,vndbinder
fi

sudo install -d -m 0755 /dev/binderfs
if ! mountpoint -q /dev/binderfs; then
  sudo mount -t binder none /dev/binderfs
fi
sudo ln -sfn /dev/binderfs/binder /dev/binder
sudo ln -sfn /dev/binderfs/hwbinder /dev/hwbinder
sudo ln -sfn /dev/binderfs/vndbinder /dev/vndbinder

sudo docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
sudo docker run -d \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  --privileged \
  --pull always \
  --memory 3g \
  --cpus 1 \
  -v "${DATA_DIR}:/data" \
  -p 127.0.0.1:5555:5555 \
  "${IMAGE}" \
  androidboot.use_memfd=true \
  androidboot.redroid_width=720 \
  androidboot.redroid_height=1600 \
  androidboot.redroid_dpi=320 \
  androidboot.redroid_fps=15 \
  androidboot.redroid_gpu_mode=guest

echo "Started ${CONTAINER_NAME}; ADB is available only on 127.0.0.1:5555."
