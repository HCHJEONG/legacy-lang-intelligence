#!/usr/bin/env bash
set -euo pipefail

: "${REMOTE_HOST:=t3a}"
: "${REMOTE_USER:=hchjeong}"
: "${REMOTE_PORT:=22}"
: "${REMOTE_BASE_DIR:=/home/${REMOTE_USER}/docker_images/legacy-lang-intelligence}"
: "${CONTAINER_NAME:=cobolai}"
: "${CONTAINER_PORT:=3000}"
: "${HOST_PORT:=3300}"
: "${SSH_PROXY_JUMP:=}"
: "${MEDIUM_INSTANCE_ID:=i-0c66613ecf80dc3cb}"
: "${CONFIGURE_ALB:=1}"

if [ ! -f analysis-output/carddemo.sqlite ]; then
  echo "analysis-output/carddemo.sqlite is required. Run the analysis/persistence steps before deploying."
  exit 1
fi

IMAGE_NAME="legacy-lang-intelligence"
IMAGE_TAG="$(date +%Y%m%d%H%M%S)"
IMAGE="${IMAGE_NAME}:${IMAGE_TAG}"
IMAGE_FILE="${IMAGE_NAME}-${IMAGE_TAG}.tar"

cleanup() { rm -f "$IMAGE_FILE"; }
trap cleanup EXIT

SSH_IDENTITY_OPTS=()
if [ -n "${SSH_KEY_PATH:-}" ] && [ -f "$SSH_KEY_PATH" ]; then
  SSH_IDENTITY_OPTS=(-i "$SSH_KEY_PATH" -o IdentitiesOnly=yes)
elif [ -f "${HOME}/.ssh/id_ed25519" ]; then
  SSH_IDENTITY_OPTS=(-i "${HOME}/.ssh/id_ed25519" -o IdentitiesOnly=yes)
elif [ -f "${HOME}/.ssh/id_rsa" ]; then
  SSH_IDENTITY_OPTS=(-i "${HOME}/.ssh/id_rsa" -o IdentitiesOnly=yes)
fi

SSH_OPTS=(-o StrictHostKeyChecking=accept-new -p "$REMOTE_PORT")
SCP_OPTS=(-o StrictHostKeyChecking=accept-new -P "$REMOTE_PORT")
if [ -n "$SSH_PROXY_JUMP" ]; then
  SSH_OPTS+=(-o "ProxyJump=$SSH_PROXY_JUMP")
  SCP_OPTS+=(-o "ProxyJump=$SSH_PROXY_JUMP")
fi
REMOTE_SERVER="$REMOTE_USER@$REMOTE_HOST"

docker build -f Dockerfile.aws -t "$IMAGE" .
docker save "$IMAGE" > "$IMAGE_FILE"
docker rmi "$IMAGE" >/dev/null 2>&1 || true

ssh "${SSH_OPTS[@]}" "${SSH_IDENTITY_OPTS[@]}" "$REMOTE_SERVER" "mkdir -p '$REMOTE_BASE_DIR/images'"
scp "${SCP_OPTS[@]}" "${SSH_IDENTITY_OPTS[@]}" "$IMAGE_FILE" "$REMOTE_SERVER:$REMOTE_BASE_DIR/images/"
ssh "${SSH_OPTS[@]}" "${SSH_IDENTITY_OPTS[@]}" "$REMOTE_SERVER" "set -eu; docker load -i '$REMOTE_BASE_DIR/images/$IMAGE_FILE'; rm -f '$REMOTE_BASE_DIR/images/$IMAGE_FILE'; docker rm -f '$CONTAINER_NAME' >/dev/null 2>&1 || true; docker run -d --restart unless-stopped --name '$CONTAINER_NAME' -p 0.0.0.0:${HOST_PORT}:${CONTAINER_PORT} '$IMAGE'"
ssh "${SSH_OPTS[@]}" "${SSH_IDENTITY_OPTS[@]}" "$REMOTE_SERVER" "docker ps --filter name=^/$CONTAINER_NAME$ --filter status=running"

if [ "$CONFIGURE_ALB" = "1" ]; then
  MEDIUM_INSTANCE_ID="$MEDIUM_INSTANCE_ID" bash "$(dirname "$0")/configure-aws-alb.sh"
fi
