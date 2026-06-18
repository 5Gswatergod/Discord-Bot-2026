FROM node:22-alpine AS base

RUN corepack enable

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json .eslintrc.cjs prettier.config.cjs ./
COPY apps/bot/package.json apps/bot/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN corepack pnpm install --frozen-lockfile

COPY apps apps
COPY packages packages

RUN corepack pnpm db:generate

FROM base AS dashboard

ENV NODE_ENV=production
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/guildforge?schema=public
ENV REDIS_URL=redis://localhost:6379
ENV DISCORD_CLIENT_ID=123456789012345678
ENV DISCORD_CLIENT_SECRET=build-placeholder
ENV NEXTAUTH_SECRET=build-placeholder-at-least-16
ENV NEXTAUTH_URL=http://localhost:3000
ENV APP_URL=http://localhost:3000

RUN corepack pnpm --filter @guildforge/dashboard build

CMD ["corepack", "pnpm", "--filter", "@guildforge/dashboard", "start"]

FROM base AS bot

ENV NODE_ENV=production

RUN corepack pnpm --filter @guildforge/bot build

CMD ["corepack", "pnpm", "--filter", "@guildforge/bot", "start"]
