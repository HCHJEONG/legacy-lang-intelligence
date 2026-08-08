#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="cobolai"
IMAGE_TAG="$(date +%Y%m%d%H%M%S)"
REMOTE_USER="${REMOTE_USER:-hchjeong}"
REMOTE_HOST="${REMOTE_HOST:?Set REMOTE_HOST to the AWS host address}"
REMOTE_PORT="${REMOTE_PORT:-22}"
REMOTE_BASE_DIR="${REMOTE_BASE_DIR:-/home/${REMOTE_USER}/docker_images/cobolai}"
NETWORK_NAME="${NETWORK_NAME:-lawvot_net}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
IMAGE_FILE_LOCAL="${ROOT_DIR}/${IMAGE_NAME}-${IMAGE_TAG}.tar"

cleanup() { rm -f "$IMAGE_FILE_LOCAL"; }
trap cleanup EXIT

docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" "$ROOT_DIR"
docker save "${IMAGE_NAME}:${IMAGE_TAG}" > "$IMAGE_FILE_LOCAL"
docker rmi "${IMAGE_NAME}:${IMAGE_TAG}" >/dev/null 2>&1 || true

ssh -p "$REMOTE_PORT" "$REMOTE_USER@$REMOTE_HOST" "mkdir -p '$REMOTE_BASE_DIR/images'"
scp -P "$REMOTE_PORT" "$IMAGE_FILE_LOCAL" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_BASE_DIR/images/"

ssh -p "$REMOTE_PORT" "$REMOTE_USER@$REMOTE_HOST" "docker load -i '$REMOTE_BASE_DIR/images/$(basename "$IMAGE_FILE_LOCAL")' && rm -f '$REMOTE_BASE_DIR/images/$(basename "$IMAGE_FILE_LOCAL")' && docker network create '$NETWORK_NAME' >/dev/null 2>&1 || true; docker rm -f cobolai >/dev/null 2>&1 || true; docker run -d --restart unless-stopped --name cobolai --network '$NETWORK_NAME' --network-alias cobolai -p 127.0.0.1:3300:3000 '${IMAGE_NAME}:${IMAGE_TAG}'"

echo "Deployed ${IMAGE_NAME}:${IMAGE_TAG}. Nginx should proxy cobolai.penvot.com to http://cobolai:3000."
