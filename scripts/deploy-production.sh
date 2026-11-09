#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.oracle.yml"
COMPOSE_ENV="$ROOT_DIR/.env"
DEPLOY_ENV="$ROOT_DIR/.deploy.env"
LOCK_FILE="$ROOT_DIR/.deploy.lock"
DASHBOARD_IMAGE="ghcr.io/5gswatergod/discord-bot-2026-dashboard"
BOT_IMAGE="ghcr.io/5gswatergod/discord-bot-2026-bot"
TARGET_TAG="${1:-}"
ROLLBACK_TAG=""
ROLLBACK_IS_LOCAL=false
DEPLOYMENT_STARTED=false

cd "$ROOT_DIR"

if [[ ! "$TARGET_TAG" =~ ^sha-[0-9a-f]{40}$ ]]; then
  echo "Usage: $0 sha-<full 40-character lowercase commit SHA>" >&2
  exit 2
fi

if [[ ! -f "$ROOT_DIR/.env" ]]; then
  echo "Missing production environment file: $ROOT_DIR/.env" >&2
  exit 1
fi

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another production operation is already running." >&2
  exit 1
fi

compose_for_tag() {
  local tag="$1"
  shift
  IMAGE_TAG="$tag" docker compose --env-file "$COMPOSE_ENV" -f "$COMPOSE_FILE" "$@"
}

read_deployed_tag() {
  [[ -f "$DEPLOY_ENV" ]] || return 0
  sed -n 's/^IMAGE_TAG=//p' "$DEPLOY_ENV" | tail -n 1 | tr -d '\r"'
}

write_deployed_tag() {
  local tag="$1"
  local temporary_file="$DEPLOY_ENV.tmp"
  umask 077
  printf 'IMAGE_TAG=%s\n' "$tag" > "$temporary_file"
  mv -f "$temporary_file" "$DEPLOY_ENV"
}

wait_for_dashboard() {
  local tag="$1"
  local container_id=""
  local state=""
  local health=""

  for _ in {1..36}; do
    container_id="$(compose_for_tag "$tag" ps -q dashboard)"
    if [[ -n "$container_id" ]]; then
      state="$(docker inspect --format '{{.State.Status}}' "$container_id" 2>/dev/null || true)"
      health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id" 2>/dev/null || true)"
      if [[ "$state" == "running" && "$health" == "healthy" ]]; then
        return 0
      fi
      if [[ "$state" == "exited" || "$state" == "dead" ]]; then
        break
      fi
    fi
    sleep 5
  done

  echo "Dashboard did not become healthy." >&2
  compose_for_tag "$tag" logs --tail=100 dashboard >&2 || true
  return 1
}

wait_for_bot() {
  local tag="$1"
  local container_id=""
  local state=""
  local initial_restarts=""
  local current_restarts=""

  container_id="$(compose_for_tag "$tag" ps -q bot)"
  if [[ -z "$container_id" ]]; then
    echo "Bot container was not created." >&2
    return 1
  fi

  initial_restarts="$(docker inspect --format '{{.RestartCount}}' "$container_id")"
  if [[ "$initial_restarts" != "0" ]]; then
    echo "Bot restarted before its stability check began (restarts=$initial_restarts)." >&2
    compose_for_tag "$tag" logs --tail=100 bot >&2 || true
    return 1
  fi

  for _ in {1..6}; do
    state="$(docker inspect --format '{{.State.Status}}' "$container_id" 2>/dev/null || true)"
    current_restarts="$(docker inspect --format '{{.RestartCount}}' "$container_id" 2>/dev/null || true)"
    if [[ "$state" != "running" || "$current_restarts" != "$initial_restarts" ]]; then
      echo "Bot failed its stability check (state=$state, restarts=$current_restarts)." >&2
      compose_for_tag "$tag" logs --tail=100 bot >&2 || true
      return 1
    fi
    sleep 5
  done
}

wait_for_lavalink() {
  local tag="$1"
  local container_id=""
  local state=""
  local health=""

  for _ in {1..36}; do
    container_id="$(compose_for_tag "$tag" ps -q lavalink)"
    if [[ -n "$container_id" ]]; then
      state="$(docker inspect --format '{{.State.Status}}' "$container_id" 2>/dev/null || true)"
      health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id" 2>/dev/null || true)"
      if [[ "$state" == "running" && "$health" == "healthy" ]]; then
        return 0
      fi
      if [[ "$state" == "exited" || "$state" == "dead" ]]; then
        break
      fi
    fi
    sleep 5
  done

  echo "Lavalink did not become healthy." >&2
  compose_for_tag "$tag" logs --tail=150 lavalink >&2 || true
  return 1
}

create_local_rollback_images() {
  local tag=""
  local dashboard_container=""
  local bot_container=""
  local dashboard_image_id=""
  local bot_image_id=""

  tag="rollback-local-$(date -u +%Y%m%d%H%M%S)"
  dashboard_container="$(docker compose --env-file "$COMPOSE_ENV" -f "$COMPOSE_FILE" ps -q dashboard)"
  bot_container="$(docker compose --env-file "$COMPOSE_ENV" -f "$COMPOSE_FILE" ps -q bot)"
  if [[ -z "$dashboard_container" || -z "$bot_container" ]]; then
    return 1
  fi

  dashboard_image_id="$(docker inspect --format '{{.Image}}' "$dashboard_container")"
  bot_image_id="$(docker inspect --format '{{.Image}}' "$bot_container")"
  docker image tag "$dashboard_image_id" "$DASHBOARD_IMAGE:$tag"
  docker image tag "$bot_image_id" "$BOT_IMAGE:$tag"

  ROLLBACK_TAG="$tag"
  ROLLBACK_IS_LOCAL=true
}

cleanup_local_rollback_images() {
  if [[ "$ROLLBACK_IS_LOCAL" == "true" && -n "$ROLLBACK_TAG" ]]; then
    docker image rm "$DASHBOARD_IMAGE:$ROLLBACK_TAG" "$BOT_IMAGE:$ROLLBACK_TAG" >/dev/null 2>&1 || true
  fi
}

rollback_application() {
  local original_status="$1"
  local rollback_status=0

  trap - ERR
  set +e
  echo "Deployment failed; rolling application containers back to $ROLLBACK_TAG." >&2

  if [[ "$ROLLBACK_IS_LOCAL" != "true" ]]; then
    compose_for_tag "$ROLLBACK_TAG" pull dashboard bot || true
  fi

  compose_for_tag "$ROLLBACK_TAG" up -d --no-deps --no-build --pull never --force-recreate dashboard ||
    rollback_status=1
  wait_for_dashboard "$ROLLBACK_TAG" || rollback_status=1
  compose_for_tag "$ROLLBACK_TAG" up -d --no-deps --no-build --pull never --force-recreate bot ||
    rollback_status=1
  wait_for_bot "$ROLLBACK_TAG" || rollback_status=1

  if [[ "$ROLLBACK_TAG" =~ ^sha-[0-9a-f]{40}$ ]]; then
    write_deployed_tag "$ROLLBACK_TAG"
  fi

  if ((rollback_status == 0)); then
    echo "Application rollback finished. Database schema changes were not reverted." >&2
  else
    echo "Application rollback was incomplete; inspect Dashboard and Bot immediately. Database schema changes were not reverted." >&2
  fi
  exit "$original_status"
}

handle_error() {
  local status=$?
  if [[ "$DEPLOYMENT_STARTED" == "true" && -n "$ROLLBACK_TAG" ]]; then
    rollback_application "$status"
  fi
  exit "$status"
}

trap handle_error ERR
trap cleanup_local_rollback_images EXIT

previous_tag="$(read_deployed_tag)"
if [[ "$previous_tag" =~ ^sha-[0-9a-f]{40}$ ]]; then
  ROLLBACK_TAG="$previous_tag"
elif create_local_rollback_images; then
  echo "No immutable deployment state found; captured the current containers for first-deploy rollback."
else
  echo "Warning: no previous application images are available for automatic rollback." >&2
fi

if [[ "$TARGET_TAG" == "$previous_tag" ]]; then
  echo "Tag $TARGET_TAG is already recorded as deployed; verifying and recreating the application containers."
fi

echo "Pulling production images for $TARGET_TAG..."
compose_for_tag "$TARGET_TAG" pull dashboard bot lavalink

echo "Starting Lavalink..."
compose_for_tag "$TARGET_TAG" up -d --no-build --force-recreate lavalink
wait_for_lavalink "$TARGET_TAG"

echo "Verifying yt-dlp, ffmpeg, and Lavalink local source..."
test "$(compose_for_tag "$TARGET_TAG" run --rm --no-deps bot yt-dlp --version | tr -d '\r')" = "2026.06.09"
compose_for_tag "$TARGET_TAG" run --rm --no-deps bot ffmpeg -version >/dev/null
compose_for_tag "$TARGET_TAG" run --rm --no-deps bot \
  ffmpeg -hide_banner -loglevel error -f lavfi -i "sine=frequency=440:duration=1" \
  -c:a libopus -y /var/lib/hydrava-music/hydrava-deploy-smoke.opus
compose_for_tag "$TARGET_TAG" run --rm --no-deps bot node -e '
  const password = process.env.LAVALINK_PASSWORD;
  const identifier = encodeURIComponent("/opt/Lavalink/music/hydrava-deploy-smoke.opus");
  fetch(`http://lavalink:2333/v4/loadtracks?identifier=${identifier}`, {
    headers: { Authorization: password }
  })
    .then(async (response) => {
      const body = await response.text();
      if (!response.ok || !body.includes("\"loadType\":\"track\"")) {
        throw new Error(`Lavalink local-source smoke failed: ${response.status} ${body}`);
      }
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
'
compose_for_tag "$TARGET_TAG" run --rm --no-deps bot \
  rm -f /var/lib/hydrava-music/hydrava-deploy-smoke.opus

echo "Applying the Prisma schema with the target Dashboard image..."
# The immutable image already contains the client generated for this schema.
compose_for_tag "$TARGET_TAG" run --rm --no-deps dashboard corepack pnpm db:push --skip-generate

DEPLOYMENT_STARTED=true

echo "Updating Dashboard..."
compose_for_tag "$TARGET_TAG" up -d --no-deps --no-build --pull never --force-recreate dashboard
wait_for_dashboard "$TARGET_TAG"

echo "Updating Bot..."
compose_for_tag "$TARGET_TAG" up -d --no-deps --no-build --pull never --force-recreate bot
wait_for_bot "$TARGET_TAG"

write_deployed_tag "$TARGET_TAG"
DEPLOYMENT_STARTED=false
trap - ERR

echo "Deployment complete: $TARGET_TAG"
compose_for_tag "$TARGET_TAG" ps dashboard bot lavalink postgres redis caddy
