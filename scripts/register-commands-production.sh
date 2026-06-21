#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.oracle.yml"
COMPOSE_ENV="$ROOT_DIR/.env"
DEPLOY_ENV="$ROOT_DIR/.deploy.env"
LOCK_FILE="$ROOT_DIR/.deploy.lock"
IMAGE_TAG="${1:-}"

cd "$ROOT_DIR"

if [[ -z "$IMAGE_TAG" && -f "$DEPLOY_ENV" ]]; then
  IMAGE_TAG="$(sed -n 's/^IMAGE_TAG=//p' "$DEPLOY_ENV" | tail -n 1 | tr -d '\r"')"
fi

if [[ ! "$IMAGE_TAG" =~ ^sha-[0-9a-f]{40}$ ]]; then
  echo "No valid deployed image tag was found. Pass sha-<full 40-character lowercase commit SHA>." >&2
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

echo "Pulling Bot image $IMAGE_TAG..."
IMAGE_TAG="$IMAGE_TAG" docker compose --env-file "$COMPOSE_ENV" -f "$COMPOSE_FILE" pull bot

echo "Registering Discord slash commands..."
IMAGE_TAG="$IMAGE_TAG" docker compose --env-file "$COMPOSE_ENV" -f "$COMPOSE_FILE" run --rm --no-deps bot \
  corepack pnpm --filter @guildforge/bot register

echo "Slash command registration complete."
