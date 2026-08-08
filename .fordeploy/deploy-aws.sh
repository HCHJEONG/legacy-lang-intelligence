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
: "${LEGACY_LANG_ENV_FILE_SOURCE:=/mnt/j/VSCodeProjects/legacy-lang-intelligence/.fordeploy/aws-backup/.env.local}"
: "${LEGACY_LANG_GCP_KEY_SOURCE:=/mnt/j/VSCodeProjects/legacy-lang-intelligence/.fordeploy/aws-backup/gcp-key.json}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

ENV_LOCAL_BACKUP=""
restore_env_local() {
  if [ -n "$ENV_LOCAL_BACKUP" ]; then
    mv -f "$ENV_LOCAL_BACKUP" "$ROOT_DIR/.env.local"
  else
    rm -f "$ROOT_DIR/.env.local"
  fi
}
if [ ! -f "$ROOT_DIR/.env.local" ]; then
  if [ ! -f "$LEGACY_LANG_ENV_FILE_SOURCE" ]; then
    echo "missing deployment env file: $LEGACY_LANG_ENV_FILE_SOURCE" >&2
    exit 1
  fi
  cp "$LEGACY_LANG_ENV_FILE_SOURCE" "$ROOT_DIR/.env.local"
else
  ENV_LOCAL_BACKUP="$ROOT_DIR/.env.local.bak.$(date +%Y%m%d%H%M%S)"
  cp "$ROOT_DIR/.env.local" "$ENV_LOCAL_BACKUP"
fi

GCP_KEY_BACKUP=""
if [ ! -f "$ROOT_DIR/gcp-key.json" ]; then
  if [ ! -f "$LEGACY_LANG_GCP_KEY_SOURCE" ]; then
    echo "missing deployment GCP key: $LEGACY_LANG_GCP_KEY_SOURCE" >&2
    exit 1
  fi
  cp "$LEGACY_LANG_GCP_KEY_SOURCE" "$ROOT_DIR/gcp-key.json"
else
  GCP_KEY_BACKUP="$ROOT_DIR/gcp-key.json.bak.$(date +%Y%m%d%H%M%S)"
  cp "$ROOT_DIR/gcp-key.json" "$GCP_KEY_BACKUP"
fi

if [ ! -f "$ROOT_DIR/analysis-output/carddemo.sqlite" ]; then
  if ! command -v npm >/dev/null 2>&1; then
    echo "npm is required to generate analysis-output/carddemo.sqlite" >&2
    exit 1
  fi
  echo "analysis-output/carddemo.sqlite is missing; generating the analysis artifact..."
  (
    cd "$ROOT_DIR"
    npm run ingest
    npm run persist
  )
fi
if [ ! -f "$ROOT_DIR/.env.local" ]; then
  echo ".env.local is required for AWS deployment and is intentionally gitignored."
  exit 1
fi
case "$REMOTE_BASE_DIR" in
  ""|/|/home|/home/"$REMOTE_USER")
    echo "REMOTE_BASE_DIR must be a dedicated application directory" >&2
    exit 1
    ;;
esac

IMAGE_NAME="legacy-lang-intelligence"
IMAGE_TAG="$(date +%Y%m%d%H%M%S)"
IMAGE="${IMAGE_NAME}:${IMAGE_TAG}"
IMAGE_FILE="$ROOT_DIR/${IMAGE_NAME}-${IMAGE_TAG}.tar"
IMAGE_BASENAME="$(basename "$IMAGE_FILE")"

cleanup() {
  rm -f "$IMAGE_FILE"
  restore_env_local
  if [ -n "$GCP_KEY_BACKUP" ]; then
    mv -f "$GCP_KEY_BACKUP" "$ROOT_DIR/gcp-key.json"
  else
    rm -f "$ROOT_DIR/gcp-key.json"
  fi
}
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

docker build -f "$ROOT_DIR/Dockerfile.aws" -t "$IMAGE" "$ROOT_DIR"
docker save "$IMAGE" > "$IMAGE_FILE"
docker rmi "$IMAGE" >/dev/null 2>&1 || true

ssh "${SSH_OPTS[@]}" "${SSH_IDENTITY_OPTS[@]}" "$REMOTE_SERVER" "mkdir -p '$REMOTE_BASE_DIR/images'"
scp "${SCP_OPTS[@]}" "${SSH_IDENTITY_OPTS[@]}" "$IMAGE_FILE" "$REMOTE_SERVER:$REMOTE_BASE_DIR/images/"
ssh "${SSH_OPTS[@]}" "${SSH_IDENTITY_OPTS[@]}" "$REMOTE_SERVER" "set -eu; docker load -i '$REMOTE_BASE_DIR/images/$IMAGE_BASENAME'; rm -f '$REMOTE_BASE_DIR/images/$IMAGE_BASENAME'; docker rm -f '$CONTAINER_NAME' >/dev/null 2>&1 || true; docker run -d --restart unless-stopped --name '$CONTAINER_NAME' -p 0.0.0.0:${HOST_PORT}:${CONTAINER_PORT} '$IMAGE'"
ssh "${SSH_OPTS[@]}" "${SSH_IDENTITY_OPTS[@]}" "$REMOTE_SERVER" "docker ps --filter name=^/$CONTAINER_NAME$ --filter status=running"

if [ "$CONFIGURE_ALB" = "1" ]; then
  MEDIUM_INSTANCE_ID="$MEDIUM_INSTANCE_ID" bash "$SCRIPT_DIR/configure-aws-alb.sh"
fi
