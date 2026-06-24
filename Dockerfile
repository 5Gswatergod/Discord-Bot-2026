FROM node:22-bookworm-slim AS dependencies

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json .eslintrc.cjs prettier.config.cjs ./
COPY apps/bot/package.json apps/bot/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    PRISMA_SKIP_POSTINSTALL_GENERATE=true corepack pnpm install --frozen-lockfile

FROM dependencies AS dashboard

COPY packages packages
COPY apps/dashboard apps/dashboard

RUN DATABASE_URL="postgresql://guildforge:build-only@localhost:5432/guildforge?schema=public" \
    corepack pnpm db:generate

ENV NODE_ENV=production

RUN DATABASE_URL="postgresql://postgres:postgres@localhost:5432/guildforge?schema=public" \
    REDIS_URL="redis://localhost:6379" \
    DISCORD_CLIENT_ID="build-client-id" \
    DISCORD_CLIENT_SECRET="build-placeholder" \
    DISCORD_BOT_TOKEN="build.bot.token" \
    NEXTAUTH_SECRET="build-placeholder-at-least-16" \
    NEXTAUTH_URL="http://localhost:3000" \
    APP_URL="http://localhost:3000" \
    corepack pnpm --filter @guildforge/dashboard build

CMD ["corepack", "pnpm", "--filter", "@guildforge/dashboard", "start"]

FROM dependencies AS bot-tools

ARG TARGETARCH
ARG YTDLP_VERSION=2026.06.09

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ffmpeg \
    && YTDLP_ARCH="${TARGETARCH:-amd64}" \
    && case "$YTDLP_ARCH" in \
      amd64) YTDLP_ASSET="yt-dlp_linux" ;; \
      arm64) YTDLP_ASSET="yt-dlp_linux_aarch64" ;; \
      *) echo "Unsupported yt-dlp architecture: $YTDLP_ARCH" >&2; exit 1 ;; \
    esac \
    && curl --fail --location --retry 3 \
      "https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/${YTDLP_ASSET}" \
      --output /usr/local/bin/yt-dlp \
    && curl --fail --location --retry 3 \
      "https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/SHA2-256SUMS" \
      --output /tmp/yt-dlp-sha256sums \
    && grep -E "[[:space:]]${YTDLP_ASSET}$" /tmp/yt-dlp-sha256sums \
      | sed "s#${YTDLP_ASSET}\$#/usr/local/bin/yt-dlp#" \
      | sha256sum --check --strict - \
    && chmod 0755 /usr/local/bin/yt-dlp \
    && test "$(/usr/local/bin/yt-dlp --version)" = "$YTDLP_VERSION" \
    && ffmpeg -version >/dev/null \
    && rm -f /tmp/yt-dlp-sha256sums \
    && rm -rf /var/lib/apt/lists/*

ENV YTDLP_PATH=/usr/local/bin/yt-dlp

FROM bot-tools AS bot

COPY packages packages
COPY apps/bot apps/bot

RUN DATABASE_URL="postgresql://guildforge:build-only@localhost:5432/guildforge?schema=public" \
    corepack pnpm db:generate

ENV NODE_ENV=production

RUN corepack pnpm --filter @guildforge/bot build

CMD ["corepack", "pnpm", "--filter", "@guildforge/bot", "start"]
