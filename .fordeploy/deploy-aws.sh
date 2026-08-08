#!/usr/bin/env bash
set -euo pipefail

: "${BASTION_HOST:=ubuntu@43.202.136.180}"
: "${PRIVATE_HOST:=ubuntu@172.31.68.164}"
: "${BASTION_SSH_KEY:=${HOME}/.ssh/penvotkeypair1.pem}"
: "${REMOTE_USER:=ubuntu}"
: "${REMOTE_PORT:=22}"
: "${REMOTE_BASE_DIR:=/home/ubuntu/docker_images/legacy-lang-intelligence}"
: "${CONTAINER_NAME:=cobolai}"
: "${CONTAINER_PORT:=3000}"
: "${HOST_PORT:=3300}"
: "${MEDIUM_INSTANCE_ID:=i-0c66613ecf80dc3cb}"
: "${CONFIGURE_ALB:=0}"
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
    npm ci
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

log() {
  printf '[legacy-lang-intelligence] %s\n' "$*"
}

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

if [ ! -f "$BASTION_SSH_KEY" ]; then
  echo "missing Bastion SSH key: $BASTION_SSH_KEY" >&2
  exit 1
fi
SSH_OPTS=(-i "$BASTION_SSH_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -p "$REMOTE_PORT")
SCP_OPTS=(-i "$BASTION_SSH_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -P "$REMOTE_PORT")
BASTION_TAR="/home/ubuntu/$IMAGE_BASENAME"
PRIVATE_TAR="/home/ubuntu/$IMAGE_BASENAME"

log "BUILD START: $IMAGE"
docker build -f "$ROOT_DIR/Dockerfile.aws" -t "$IMAGE" "$ROOT_DIR"
log "BUILD COMPLETE: $IMAGE"
docker save "$IMAGE" > "$IMAGE_FILE"
docker rmi "$IMAGE" >/dev/null 2>&1 || true

log "IMAGE ARCHIVE READY: $IMAGE_FILE"
log "TRANSFERRING IMAGE TO BASTION: $BASTION_HOST"
scp "${SCP_OPTS[@]}" "$IMAGE_FILE" "$BASTION_HOST:$BASTION_TAR"
log "IMAGE ARRIVED AT BASTION"
ssh "${SSH_OPTS[@]}" "$BASTION_HOST" \
  PRIVATE_HOST="$PRIVATE_HOST" \
  BASTION_TAR="$BASTION_TAR" \
  PRIVATE_TAR="$PRIVATE_TAR" \
  REMOTE_BASE_DIR="$REMOTE_BASE_DIR" \
  IMAGE="$IMAGE" \
  CONTAINER_NAME="$CONTAINER_NAME" \
  HOST_PORT="$HOST_PORT" \
  CONTAINER_PORT="$CONTAINER_PORT" \
  bash -s <<'BASTION_SCRIPT'
set -euo pipefail
echo "[bastion] transferring image to private host: $PRIVATE_HOST"
scp -i ~/.ssh/penvotkeypair1.pem -o StrictHostKeyChecking=accept-new "$BASTION_TAR" "$PRIVATE_HOST:$PRIVATE_TAR"
ssh -i ~/.ssh/penvotkeypair1.pem -o StrictHostKeyChecking=accept-new "$PRIVATE_HOST" \
  BASTION_TAR="$BASTION_TAR" \
  PRIVATE_TAR="$PRIVATE_TAR" \
  REMOTE_BASE_DIR="$REMOTE_BASE_DIR" \
  IMAGE="$IMAGE" \
  CONTAINER_NAME="$CONTAINER_NAME" \
  HOST_PORT="$HOST_PORT" \
  CONTAINER_PORT="$CONTAINER_PORT" \
  bash -s <<'PRIVATE_SCRIPT'
set -euo pipefail
echo "[private] loading image and replacing container: $CONTAINER_NAME"
mkdir -p "$REMOTE_BASE_DIR/images"
mv "$PRIVATE_TAR" "$REMOTE_BASE_DIR/images/"
docker load -i "$REMOTE_BASE_DIR/images/$(basename "$PRIVATE_TAR")"
rm -f "$REMOTE_BASE_DIR/images/$(basename "$PRIVATE_TAR")"
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker run -d --restart unless-stopped --name "$CONTAINER_NAME" \
  -p "0.0.0.0:${HOST_PORT}:${CONTAINER_PORT}" "$IMAGE"
if ! docker ps --filter "name=^/$CONTAINER_NAME$" --filter status=running --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  echo "[private] container did not enter running state" >&2
  docker ps -a --filter "name=^/$CONTAINER_NAME$"
  docker logs --tail 80 "$CONTAINER_NAME" || true
  exit 1
fi
echo "[private] container is running"
docker ps --filter "name=^/$CONTAINER_NAME$" --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
health_ready=0
for attempt in $(seq 1 30); do
  if curl -fsS --max-time 5 "http://127.0.0.1:${HOST_PORT}/en" >/dev/null; then
    health_ready=1
    break
  fi
  echo "[private] waiting for HTTP health check ($attempt/30)"
  sleep 2
done
if [ "$health_ready" -ne 1 ]; then
  echo "[private] health check failed on http://127.0.0.1:${HOST_PORT}/en" >&2
  docker logs --tail 80 "$CONTAINER_NAME" || true
  exit 1
fi
echo "[private] HTTP health check passed"
PRIVATE_SCRIPT
rm -f "$BASTION_TAR"
BASTION_SCRIPT
log "REMOTE DEPLOYMENT COMPLETE: $CONTAINER_NAME on $PRIVATE_HOST:$HOST_PORT"

if [ "$CONFIGURE_ALB" = "1" ]; then
  if command -v aws >/dev/null 2>&1; then
    log "CONFIGURING ALB TARGET AND RULES"
    MEDIUM_INSTANCE_ID="$MEDIUM_INSTANCE_ID" bash "$SCRIPT_DIR/configure-aws-alb.sh"
  else
    log "WARNING: AWS CLI is not installed; skipping ALB configuration"
    log "WARNING: configure the target group separately or rerun with AWS CLI available"
  fi
fi
log "DEPLOY SUCCESS: https://cobolai.penvot.com"
