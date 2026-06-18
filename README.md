# GuildForge

GuildForge is a self-hosted, modular Discord community management system. It is inspired by the broad category of Discord administration bots, but it uses original naming, structure, UI, and code.

This repository currently implements Phases 1 through 5 from `Task.md`:

- pnpm monorepo with `apps/bot`, `apps/dashboard`, `packages/database`, `packages/shared`, and `packages/config`
- Prisma schema for all requested guild-scoped modules and records
- Discord bot foundation with discord.js v14, slash command registration, guild sync, Redis connection, and utility commands
- Next.js 14 dashboard with Discord OAuth login, Manage Guild filtering, guild selector, and server overview
- Docker Compose for bot, dashboard, PostgreSQL, and Redis
- Moderation commands with permission checks, case numbering, warnings, audit records, and moderation logs
- Logging handlers for messages, members, bans, roles, channels, voice joins/leaves, and moderation events
- Welcome and goodbye messages with templates, embeds, and optional auto role assignment
- Dashboard API and settings UI for module toggles, moderation, logging, and welcome configuration
- Leveling with Redis cooldowns, configurable XP formulas, `/rank`, `/leaderboard`, XP reset, level-up messages, and role rewards
- AutoMod rules for banned words, spam, links, invites, mass mentions, repeated messages, and caps lock
- Prefix-based custom commands with cooldowns, allowed roles/channels, variables, and dashboard CRUD
- Reaction role panels with buttons, emoji reactions, single-select, multi-select, and dashboard publishing controls
- Button-based giveaways with role gates, scheduled expiry, manual end, reroll, and winner announcements
- Button polls with 2-10 options, public or anonymous results, expiry support, and dashboard management
- Social alert workers for YouTube RSS feeds, RSS feeds, and Twitch live checks with dashboard-managed templates
- Deployment-focused Docker Compose defaults with service health checks, restart policies, and container-safe database URLs

## Stack

- TypeScript
- discord.js v14
- Next.js 14 App Router
- NextAuth.js with Discord OAuth2
- PostgreSQL and Prisma ORM
- Redis for cooldown/cache-backed modules
- Tailwind CSS with shadcn-style local UI primitives
- pnpm workspace

## Project Layout

```txt
apps/
  bot/          Discord bot runtime and slash commands
  dashboard/    Web management dashboard
packages/
  config/       Environment schemas
  database/     Prisma schema, client, and seed script
  shared/       Shared module metadata, permissions, and validators
```

## Prerequisites

- Node.js 20.11 or newer
- Corepack enabled
- Docker Desktop, if running PostgreSQL and Redis through Docker
- A Discord application with a bot token and OAuth2 credentials

## Setup

```bash
corepack enable
corepack pnpm install
cp .env.example .env
```

If your shell already has a global `pnpm` command, the `corepack pnpm` prefix can be shortened to `pnpm`.

Edit `.env` with your Discord application values:

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_BOT_TOKEN`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

Twitch social alerts are optional. To enable live checks, also set:

- `TWITCH_CLIENT_ID`
- `TWITCH_ACCESS_TOKEN`

For local development, keep:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/guildforge?schema=public"
REDIS_URL="redis://localhost:6379"
NEXTAUTH_URL="http://localhost:3000"
APP_URL="http://localhost:3000"
```

## Database

Start services:

```bash
docker compose up -d postgres redis
```

Generate Prisma Client and push the schema:

```bash
corepack pnpm db:generate
corepack pnpm db:push
corepack pnpm seed
```

## Discord OAuth Redirect

In the Discord Developer Portal, add:

```txt
http://localhost:3000/api/auth/callback/discord
```

The dashboard requests `identify guilds`, then filters servers to only those where the signed-in user has Administrator or Manage Server permission.

## Slash Commands

For fast local command registration, set `DISCORD_TEST_GUILD_ID` in `.env`, then run:

```bash
corepack pnpm --filter @guildforge/bot register
```

Current utility commands:

- `/ping`
- `/serverinfo`
- `/userinfo`

Current moderation commands:

- `/ban`
- `/kick`
- `/timeout`
- `/warn`
- `/warnings`
- `/clear`
- `/mute`
- `/unmute`
- `/slowmode`
- `/lock`
- `/unlock`

Moderation commands require the Moderation module to be enabled in the dashboard. Users may run them when they have a configured moderator role or a Discord permission such as Administrator, Manage Server, Moderate Members, Kick Members, Ban Members, Manage Messages, or Manage Channels.

Current leveling commands:

- `/rank`
- `/leaderboard`
- `/xp reset`

Current reaction role commands:

- `/reaction-role publish`

Current giveaway commands:

- `/giveaway create`
- `/giveaway end`
- `/giveaway reroll`

Current poll commands:

- `/poll create`

Current social alert commands:

- `/social-alert check`
- `/social-alert test`

## Development

Run both apps:

```bash
corepack pnpm dev
```

Run individually:

```bash
corepack pnpm dev:bot
corepack pnpm dev:dashboard
```

Dashboard URL:

```txt
http://localhost:3000
```

## Docker Compose

After creating `.env`, the full stack can be started with:

```bash
docker compose up
```

The compose file starts:

- `postgres`
- `redis`
- `bot`
- `dashboard`

Inside Compose, bot and dashboard use `CONTAINER_DATABASE_URL` and `CONTAINER_REDIS_URL` when present, otherwise they default to the `postgres` and `redis` service hostnames. This avoids the common container issue where `localhost` points at the app container instead of the database.

## Render Deployment

This repo includes a `render.yaml` Blueprint for Render:

- Traditional Chinese step-by-step guide: [`RENDER_DEPLOYMENT.md`](./RENDER_DEPLOYMENT.md)
- `guildforge-dashboard`: web service for the Next.js dashboard
- `guildforge-bot`: background worker for the Discord bot
- `guildforge-postgres`: Render Postgres database
- `guildforge-redis`: Render Key Value instance for Redis-compatible caching

Recommended flow:

1. Push this repository to GitHub.
2. In Render, create a new Blueprint from the repo.
3. Fill the prompted secrets:
   - `DISCORD_CLIENT_ID`
   - `DISCORD_CLIENT_SECRET`
   - `DISCORD_BOT_TOKEN`
   - `NEXTAUTH_URL`
   - `APP_URL`
4. Use the dashboard service URL for both `NEXTAUTH_URL` and `APP_URL`, for example:

```txt
https://guildforge-dashboard.onrender.com
```

5. In the Discord Developer Portal, add the production OAuth callback:

```txt
https://guildforge-dashboard.onrender.com/api/auth/callback/discord
```

6. Deploy the Blueprint. The dashboard service runs `corepack pnpm db:push` as its pre-deploy command to apply the Prisma schema to Render Postgres.

The Blueprint is configured to auto-deploy only after CI checks pass. The included GitHub Actions workflow runs Prisma generation, typecheck, lint, and production build.

Optional Twitch live alerts require setting these Render environment variables on the shared environment group:

- `TWITCH_CLIENT_ID`
- `TWITCH_ACCESS_TOKEN`

## Verification

```bash
corepack pnpm db:generate
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
docker compose config --quiet
```

## Dashboard Settings

The server overview includes:

- Module toggles
- Moderation settings: moderator role IDs, log channel ID, mute role ID, default timeout
- Welcome settings: welcome/goodbye channel IDs, message templates, auto role, embed color
- Logging settings: event-level enablement and channel routing
- Leveling settings: XP per message, cooldown, formula, base XP, level-up message, ignored channels, role rewards
- AutoMod settings: event rules, punishments, ignored roles/channels, trigger-specific thresholds
- Custom Commands settings: prefix, command response text, cooldown, allowed roles/channels
- Reaction Roles settings: panel channel, embed title, description, color, role options, button/reaction mode, single or multi-select
- Giveaway settings: prize, channel, winner count, required role, and end time
- Poll settings: question, channel, visibility, optional end time, and 2-10 options
- Social Alerts settings: source type, source ID, source URL, channel ID, message template, interval, and enablement

Supported template variables:

- `{user}`
- `{username}`
- `{server}`
- `{memberCount}`
- `{level}` and `{xp}` for level-up messages

Custom command responses also support `{channel}`.

Social alert templates support:

- `{title}`
- `{url}`
- `{author}`
- `{source}`
- `{type}`
- `{server}`
- `{publishedAt}`

## Completed Scope

All requested phases in `Task.md` are now represented in the bot runtime, dashboard UI, shared validation layer, Prisma schema, README, and Docker Compose setup. Social alerts are intentionally conservative on first run: the worker records the latest item as a baseline, then posts future changes. Use `/social-alert test` to send the current latest item manually.
