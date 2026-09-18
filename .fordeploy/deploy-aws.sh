#!/usr/bin/env bash
set -euo pipefail

: "${BASTION_HOST:=ubuntu@43.202.136.180}"
: "${PRIVATE_HOST:=ubuntu@172.31.76.194}"
: "${BASTION_SSH_KEY:=${HOME}/.ssh/penvotkeypair1.pem}"
: "${REMOTE_USER:=ubuntu}"
: "${REMOTE_PORT:=22}"
: "${REMOTE_BASE_DIR:=/home/ubuntu/legacy-lang-intelligence/docker_images}"
: "${APP_DIR_ON_PRIVATE:=/home/ubuntu/cobolai}"
: "${ENV_FILE_ON_PRIVATE:=${APP_DIR_ON_PRIVATE}/.env.local}"
: "${GCP_KEY_ON_PRIVATE:=${APP_DIR_ON_PRIVATE}/gcp-key.json}"
: "${ANALYSIS_OUTPUT_ON_PRIVATE:=${APP_DIR_ON_PRIVATE}/analysis-output}"
: "${HEALTH_CHECK_PATH:=/en}"
: "${CONTAINER_NAME:=cobolai}"
: "${CONTAINER_PORT:=3000}"
: "${HOST_PORT:=3300}"
: "${MEDIUM_INSTANCE_ID:=i-0fa95bb4eff77caf2}"
: "${CONFIGURE_ALB:=0}"
: "${CLEAN_CLONE_ROOT:=${HOME}/deploy-remote-repo}"
: "${DEPLOY_BRANCH:=main}"
: "${REPO_URL:=git@github.com:HCHJEONG/legacy-lang-intelligence.git}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
case "$REMOTE_BASE_DIR" in
  ""|/|/home|/home/"$REMOTE_USER")
    echo "REMOTE_BASE_DIR must be a dedicated application directory" >&2
    exit 1
    ;;
esac

case "$APP_DIR_ON_PRIVATE" in
  ""|/|/home|/home/"$REMOTE_USER")
    echo "APP_DIR_ON_PRIVATE must be a dedicated application directory" >&2
    exit 1
    ;;
esac

IMAGE_NAME="legacy-lang-intelligence"
IMAGE_TAG="$(date +%Y%m%d%H%M%S)-$$"
IMAGE="${IMAGE_NAME}:${IMAGE_TAG}"
IMAGE_FILE="$ROOT_DIR/${IMAGE_NAME}-${IMAGE_TAG}.tar"
IMAGE_BASENAME="$(basename "$IMAGE_FILE")"

log() {
  printf '[legacy-lang-intelligence] %s\n' "$*"
}

cleanup() {
  rm -f -- "$IMAGE_FILE"
  docker image rm "$IMAGE" >/dev/null 2>&1 || true
  if [ "${TRANSFER_STARTED:-0}" = 1 ]; then
    ssh "${SSH_OPTS[@]}" "$BASTION_HOST" "rm -f -- '$BASTION_TAR'" || true
  fi
}
trap cleanup EXIT

if [ ! -f "$BASTION_SSH_KEY" ]; then
  echo "missing Bastion SSH key: $BASTION_SSH_KEY" >&2
  exit 1
fi
SSH_OPTS=(-i "$BASTION_SSH_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -p "$REMOTE_PORT")
SCP_OPTS=(-i "$BASTION_SSH_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -P "$REMOTE_PORT")
# These paths are also passed through SSH's remote shell.
for remote_path in "$REMOTE_BASE_DIR" "$APP_DIR_ON_PRIVATE" "$ENV_FILE_ON_PRIVATE" "$GCP_KEY_ON_PRIVATE" "$ANALYSIS_OUTPUT_ON_PRIVATE"; do
  if [[ ! "$remote_path" =~ ^/[a-zA-Z0-9_./-]+$ ]] || [[ "/$remote_path/" == *"/../"* ]]; then
    echo "Remote paths must be absolute, without spaces or shell metacharacters: $remote_path" >&2
    exit 1
  fi
done
BASTION_TAR="$REMOTE_BASE_DIR/$IMAGE_BASENAME"
PRIVATE_TAR="$REMOTE_BASE_DIR/$IMAGE_BASENAME"

# BEGIN CLEAN CLONE
# Only this dedicated repository child may be reset/cleaned. Keep the lock
# until deployment exits so another build cannot change its source mid-build.
case "$CLEAN_CLONE_ROOT" in
  /*) ;;
  *) echo "CLEAN_CLONE_ROOT must be absolute" >&2; exit 1 ;;
esac
[ ! -L "$CLEAN_CLONE_ROOT" ] || { echo "Clone parent must not be a symlink" >&2; exit 1; }
CLEAN_CLONE_ROOT="$(realpath -m -- "$CLEAN_CLONE_ROOT")"
[ "${CLEAN_CLONE_ROOT##*/}" = deploy-remote-repo ] || { echo "Clone parent must be named deploy-remote-repo" >&2; exit 1; }
BUILD_DIR="$CLEAN_CLONE_ROOT/legacy-lang-intelligence"
[ ! -L "$BUILD_DIR" ] && [ "$(realpath -m -- "$BUILD_DIR")" = "$BUILD_DIR" ] || {
  echo "Clean clone must not be a symlink" >&2; exit 1;
}
case "$(realpath -- "$ROOT_DIR")/" in
  "$BUILD_DIR/"*) echo "Run deployment from the working repository, outside the clean clone" >&2; exit 1 ;;
esac
git check-ref-format --branch "$DEPLOY_BRANCH" >/dev/null
mkdir -p -- "$CLEAN_CLONE_ROOT"
exec 8>"$CLEAN_CLONE_ROOT/.legacy-lang-intelligence-build.lock"
flock -n 8 || { echo "Another deployment is using the clean clone" >&2; exit 1; }
if [ ! -e "$BUILD_DIR" ]; then
  git clone --single-branch --branch "$DEPLOY_BRANCH" -- "$REPO_URL" "$BUILD_DIR"
fi
[ -d "$BUILD_DIR/.git" ] && [ ! -L "$BUILD_DIR/.git" ] &&
  [ "$(git -C "$BUILD_DIR" rev-parse --show-toplevel)" = "$BUILD_DIR" ] || {
  echo "Clean clone must be a standalone Git repository" >&2; exit 1;
}
[ "$(git -C "$BUILD_DIR" remote get-url origin)" = "$REPO_URL" ] || {
  echo "Clean clone origin does not match REPO_URL" >&2; exit 1;
}
git -C "$BUILD_DIR" fetch --prune origin \
  "+refs/heads/$DEPLOY_BRANCH:refs/remotes/origin/$DEPLOY_BRANCH"
BUILD_COMMIT="$(git -C "$BUILD_DIR" rev-parse --verify "refs/remotes/origin/$DEPLOY_BRANCH^{commit}")"
git -C "$BUILD_DIR" checkout --force --detach "$BUILD_COMMIT"
git -C "$BUILD_DIR" reset --hard "$BUILD_COMMIT"
git -C "$BUILD_DIR" clean -fdx
[ "$(git -C "$BUILD_DIR" rev-parse HEAD)" = "$BUILD_COMMIT" ] &&
  [ -z "$(git -C "$BUILD_DIR" status --porcelain --untracked-files=all)" ] || {
  echo "Clean clone verification failed" >&2; exit 1;
}
log "BUILD SOURCE: $BUILD_DIR at $BUILD_COMMIT (origin/$DEPLOY_BRANCH)"
# END CLEAN CLONE

log "BUILD START: $IMAGE"
docker build --label com.legacy-lang-intelligence.deployment=aws \
  --label "org.opencontainers.image.revision=$BUILD_COMMIT" \
  -f "$BUILD_DIR/Dockerfile.aws" -t "$IMAGE" "$BUILD_DIR"
log "BUILD COMPLETE: $IMAGE"
docker save "$IMAGE" > "$IMAGE_FILE"
docker rmi "$IMAGE" >/dev/null 2>&1 || true

log "IMAGE ARCHIVE READY: $IMAGE_FILE"
log "TRANSFERRING IMAGE TO BASTION: $BASTION_HOST"
ssh "${SSH_OPTS[@]}" "$BASTION_HOST" "mkdir -p -- '$REMOTE_BASE_DIR'"
TRANSFER_STARTED=1
scp "${SCP_OPTS[@]}" "$IMAGE_FILE" "$BASTION_HOST:$BASTION_TAR"
log "IMAGE ARRIVED AT BASTION"
ssh "${SSH_OPTS[@]}" "$BASTION_HOST" \
  PRIVATE_HOST="$PRIVATE_HOST" \
  BASTION_TAR="$BASTION_TAR" \
  PRIVATE_TAR="$PRIVATE_TAR" \
  REMOTE_BASE_DIR="$REMOTE_BASE_DIR" \
  APP_DIR_ON_PRIVATE="$APP_DIR_ON_PRIVATE" \
  ENV_FILE_ON_PRIVATE="$ENV_FILE_ON_PRIVATE" \
  GCP_KEY_ON_PRIVATE="$GCP_KEY_ON_PRIVATE" \
  ANALYSIS_OUTPUT_ON_PRIVATE="$ANALYSIS_OUTPUT_ON_PRIVATE" \
  HEALTH_CHECK_PATH="$HEALTH_CHECK_PATH" \
  IMAGE="$IMAGE" \
  CONTAINER_NAME="$CONTAINER_NAME" \
  HOST_PORT="$HOST_PORT" \
  CONTAINER_PORT="$CONTAINER_PORT" \
  bash -s <<'BASTION_SCRIPT'
set -euo pipefail
cleanup_bastion() {
  rm -f -- "$BASTION_TAR"
  ssh -i ~/.ssh/penvotkeypair1.pem -o StrictHostKeyChecking=accept-new "$PRIVATE_HOST" "rm -f -- '$PRIVATE_TAR'" || true
}
trap cleanup_bastion EXIT
# Recover archives left by interrupted older deployments (including old paths).
for archive_dir in "$REMOTE_BASE_DIR" /home/ubuntu /home/ubuntu/docker_images/cobolai/images; do
  [ -d "$archive_dir" ] || continue
  find "$archive_dir" -maxdepth 1 -type f -name 'legacy-lang-intelligence-*.tar' -mmin +1440 -delete
done
ssh -i ~/.ssh/penvotkeypair1.pem -o StrictHostKeyChecking=accept-new "$PRIVATE_HOST" "mkdir -p -- '$REMOTE_BASE_DIR'"
echo "[bastion] transferring image to private host: $PRIVATE_HOST"
scp -i ~/.ssh/penvotkeypair1.pem -o StrictHostKeyChecking=accept-new "$BASTION_TAR" "$PRIVATE_HOST:$PRIVATE_TAR"
ssh -i ~/.ssh/penvotkeypair1.pem -o StrictHostKeyChecking=accept-new "$PRIVATE_HOST" \
  BASTION_TAR="$BASTION_TAR" \
  PRIVATE_TAR="$PRIVATE_TAR" \
  REMOTE_BASE_DIR="$REMOTE_BASE_DIR" \
  APP_DIR_ON_PRIVATE="$APP_DIR_ON_PRIVATE" \
  ENV_FILE_ON_PRIVATE="$ENV_FILE_ON_PRIVATE" \
  GCP_KEY_ON_PRIVATE="$GCP_KEY_ON_PRIVATE" \
  ANALYSIS_OUTPUT_ON_PRIVATE="$ANALYSIS_OUTPUT_ON_PRIVATE" \
  HEALTH_CHECK_PATH="$HEALTH_CHECK_PATH" \
  IMAGE="$IMAGE" \
  CONTAINER_NAME="$CONTAINER_NAME" \
  HOST_PORT="$HOST_PORT" \
  CONTAINER_PORT="$CONTAINER_PORT" \
  bash -s <<'PRIVATE_SCRIPT'
set -euo pipefail
trap 'rm -f -- "$PRIVATE_TAR"' EXIT
# Serialize container replacement and retention cleanup on this host.
exec 9>"$REMOTE_BASE_DIR/.deploy.lock"
flock -n 9 || { echo "[private] another deployment is running" >&2; exit 1; }
for archive_dir in "$REMOTE_BASE_DIR" /home/ubuntu /home/ubuntu/docker_images/cobolai/images; do
  [ -d "$archive_dir" ] || continue
  find "$archive_dir" -maxdepth 1 -type f -name 'legacy-lang-intelligence-*.tar' -mmin +1440 ! -path "$PRIVATE_TAR" -delete
done
echo "[private] loading image and replacing container: $CONTAINER_NAME"
DOCKER="sudo docker"
if [ ! -d "$APP_DIR_ON_PRIVATE" ]; then
  echo "[private] missing app dir: $APP_DIR_ON_PRIVATE" >&2
  exit 1
fi
if [ ! -f "$ENV_FILE_ON_PRIVATE" ]; then
  echo "[private] missing env file: $ENV_FILE_ON_PRIVATE" >&2
  exit 1
fi
if [ ! -f "$GCP_KEY_ON_PRIVATE" ]; then
  echo "[private] missing gcp key file: $GCP_KEY_ON_PRIVATE" >&2
  exit 1
fi
if [ ! -d "$ANALYSIS_OUTPUT_ON_PRIVATE" ]; then
  echo "[private] missing analysis output dir: $ANALYSIS_OUTPUT_ON_PRIVATE" >&2
  exit 1
fi
PREVIOUS_IMAGE_ID="$($DOCKER inspect --format '{{.Image}}' "$CONTAINER_NAME" 2>/dev/null || true)"
$DOCKER load -i "$PRIVATE_TAR"
rm -f -- "$PRIVATE_TAR"
$DOCKER rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
$DOCKER run -d --restart unless-stopped --name "$CONTAINER_NAME" \
  -p "0.0.0.0:${HOST_PORT}:${CONTAINER_PORT}" \
  --env-file "$ENV_FILE_ON_PRIVATE" \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/gcp-key.json \
  -v "${ANALYSIS_OUTPUT_ON_PRIVATE}:/app/analysis-output" \
  -v "${GCP_KEY_ON_PRIVATE}:/app/gcp-key.json:ro" \
  "$IMAGE"
if ! $DOCKER ps --filter "name=^/$CONTAINER_NAME$" --filter status=running --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  echo "[private] container did not enter running state" >&2
  $DOCKER ps -a --filter "name=^/$CONTAINER_NAME$"
  $DOCKER logs --tail 80 "$CONTAINER_NAME" || true
  exit 1
fi
echo "[private] container is running"
$DOCKER ps --filter "name=^/$CONTAINER_NAME$" --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
health_ready=0
for attempt in $(seq 1 30); do
  if curl -fsS --max-time 5 "http://127.0.0.1:${HOST_PORT}${HEALTH_CHECK_PATH}" >/dev/null; then
    health_ready=1
    break
  fi
  echo "[private] waiting for HTTP health check ($attempt/30)"
  sleep 2
done
if [ "$health_ready" -ne 1 ]; then
  echo "[private] health check failed on http://127.0.0.1:${HOST_PORT}${HEALTH_CHECK_PATH}" >&2
  $DOCKER logs --tail 80 "$CONTAINER_NAME" || true
  exit 1
fi
echo "[private] HTTP health check passed"
# Remove stopped leftovers only when both the container name and image belong
# to this app. Never force removal or prune shared Docker resources.
while read -r id name image state; do
  case "$name" in "$CONTAINER_NAME"-*) ;; *) continue ;; esac
  case "$image" in legacy-lang-intelligence:*) ;; *) continue ;; esac
  case "$state" in exited|dead|created) ;; *) continue ;; esac
  $DOCKER rm "$id" || echo "[private] kept container: $id" >&2
done < <($DOCKER ps -a --format '{{.ID}} {{.Names}} {{.Image}} {{.State}}')

CURRENT_IMAGE_ID="$($DOCKER image inspect --format '{{.Id}}' "$IMAGE")"
while read -r image; do
  case "$image" in legacy-lang-intelligence:*) ;; *) continue ;; esac
  id="$($DOCKER image inspect --format '{{.Id}}' "$image")"
  [ "$id" != "$CURRENT_IMAGE_ID" ] && [ "$id" != "$PREVIOUS_IMAGE_ID" ] || continue
  [ -z "$($DOCKER ps -aq --filter "ancestor=$id")" ] || continue
  $DOCKER image rm "$image" || echo "[private] kept image: $image" >&2
done < <($DOCKER image ls --format '{{.Repository}}:{{.Tag}}' legacy-lang-intelligence)
while read -r id; do
  [ -n "$id" ] && [ "$id" != "$CURRENT_IMAGE_ID" ] && [ "$id" != "$PREVIOUS_IMAGE_ID" ] || continue
  [ -z "$($DOCKER ps -aq --filter "ancestor=$id")" ] || continue
  $DOCKER image rm "$id" || echo "[private] kept untagged image: $id" >&2
done < <($DOCKER image ls --no-trunc -q --filter dangling=true --filter label=com.legacy-lang-intelligence.deployment=aws)
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
