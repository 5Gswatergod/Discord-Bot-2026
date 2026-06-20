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
    NEXTAUTH_SECRET="build-placeholder-at-least-16" \
    NEXTAUTH_URL="http://localhost:3000" \
    APP_URL="http://localhost:3000" \
    corepack pnpm --filter @guildforge/dashboard build

CMD ["corepack", "pnpm", "--filter", "@guildforge/dashboard", "start"]

FROM dependencies AS bot

COPY packages packages
COPY apps/bot apps/bot

RUN DATABASE_URL="postgresql://guildforge:build-only@localhost:5432/guildforge?schema=public" \
    corepack pnpm db:generate

ENV NODE_ENV=production

RUN corepack pnpm --filter @guildforge/bot build

CMD ["corepack", "pnpm", "--filter", "@guildforge/bot", "start"]
