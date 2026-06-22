# Hydrava

Hydrava is a self-hosted, modular Discord community management system. It is inspired by the broad category of Discord administration bots, but it uses original naming, structure, UI, and code.

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
- Private ticket channels with support-role access, claim/close controls, logs, and an auto-synced panel
- Invite attribution, join announcements, `/invites`, and `/invite-leaderboard`
- Dashboard-managed Discord embed messages with live previews and automatic message synchronization
- Persistent one-time and recurring reminders managed from the dashboard or `/reminder`
- Starboard reactions with configurable thresholds, ignored channels, and automatic cleanup
- Achievements based on message count, level, or invites, with optional role rewards
- Member birthdays with timezone-aware announcements and an upcoming birthday command
- Auto-updating server statistic channels for members, bots, roles, and channel counts
- Join-to-create temporary voice channels with owner rename and user-limit controls
- Advanced automation rules for messages, reactions, member joins, and role changes
- Automation conditions for channels, roles, keywords, weekdays, time ranges, and timezones
- Ordered automation actions for messages, roles, message deletion, timeouts, kicks, and bans
- Dry-run testing, persistent execution logs, cooldowns, event deduplication, and loop prevention
- Notification adapters for TikTok, X, Bluesky, Reddit, Instagram, Kick, and Podcast sources
- Shared notification templates, role/everyone mentions, persistent delivery deduplication, retry backoff, and hourly rate limits
- Optional Hydrava AI personas with channel scoping, mention-only mode, daily cost limits, and provider-neutral chat-completions configuration
- Membership plans with signed entitlement webhooks, manual grants, subscription roles, private-channel access, expiry, and grace periods
- EVM wallet signature verification, ERC-721/ERC-1155 balance checks, role synchronization, private channels, and verification notifications
- Oracle Cloud production deployment with Docker, PostgreSQL, Redis, Caddy HTTPS, health checks, and persistent volumes

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

Reddit Data API notifications are optional. Configure an approved Reddit OAuth application with:

- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `REDDIT_USER_AGENT`

Batch 5 integrations are optional and remain inactive without their environment values:

- AI: `AI_API_BASE_URL`, `AI_API_KEY`, `AI_MODEL`
- Membership webhook signing: `MEMBERSHIP_WEBHOOK_SECRET`
- Web3 RPC mapping: `WEB3_RPC_URLS_JSON`, for example `{"1":"https://...","137":"https://..."}`

Membership providers send JSON to `/api/webhooks/memberships/{guildId}` with an
`x-hydrava-signature: sha256=<hex>` HMAC generated from the raw request body and
`MEMBERSHIP_WEBHOOK_SECRET`. Payloads include `eventId`, `occurredAt`, Discord `userId`,
Dashboard `planKey`, `status`, optional `externalId`, and optional `expiresAt`. Hydrava rejects
invalid signatures, ignores duplicate event IDs, and prevents older events from overwriting newer
subscription state.

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

Database commands always load `DATABASE_URL` from the repository root `.env`, even though pnpm executes them from `packages/database`.

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

Current utility management commands:

- `/ticket close`
- `/invites`
- `/invite-leaderboard`
- `/reminder create`
- `/reminder cancel`

Current community engagement commands:

- `/achievements`
- `/birthday set`
- `/birthday remove`
- `/birthday upcoming`
- `/server-stats`
- `/voice rename`
- `/voice limit`

Current optional integration commands:

- `/membership grant`
- `/membership revoke`
- `/membership status`
- `/wallet challenge`
- `/wallet verify`
- `/wallet status`
- `/wallet unlink`

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

## Oracle Cloud Deployment

The recommended no-monthly-cost deployment uses an Oracle Cloud Always Free Compute VM:

- Traditional Chinese guide: [`ORACLE_CLOUD_DEPLOYMENT.md`](./ORACLE_CLOUD_DEPLOYMENT.md)
- Fast GHCR deployment guide: [`PRODUCTION_DEPLOYMENT.md`](./PRODUCTION_DEPLOYMENT.md)
- Production Dockerfile: [`Dockerfile`](./Dockerfile)
- Production Compose stack: [`docker-compose.oracle.yml`](./docker-compose.oracle.yml)
- Automatic HTTPS proxy: [`Caddyfile`](./Caddyfile)

The Oracle stack runs Dashboard, Bot, PostgreSQL, Redis, and Caddy on one VM. PostgreSQL and Redis remain private inside the Docker network, while Caddy exposes HTTPS on ports 80 and 443.

Production images are built on GitHub-hosted runners and deployed through the manually approved
`Deploy Production` workflow. The VM only pulls immutable images, applies the Prisma schema, and
restarts Dashboard and Bot; it does not compile the application.

Emergency local builds on a low-memory VM must run sequentially:

```bash
docker compose -f docker-compose.oracle.yml build bot
docker compose -f docker-compose.oracle.yml build dashboard
```

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
- Social Alerts settings: platform, source/feed URL, channel, shared message template, mentions, interval, per-check batch size, hourly rate limit, health state, and enablement
- Ticket settings: panel channel, category, support roles, log channel, panel copy, and open-ticket limit
- Invite Tracking settings: announcement channel, message template, bot tracking, and leaderboard
- Embed Messages editor: channel, content, title, description, colors, media, footer, preview, and enablement
- Reminder settings: channel, next run time, message, recurring interval, and enablement
- Starboard settings: destination channel, emoji, threshold, ignored channels, and cleanup behavior
- Achievement settings: trigger, threshold, role reward, announcement channel, and message template
- Hydrava AI settings: persona, system prompt, allowed channels, mention-only mode, context size, response limit, temperature, and daily request cap
- Membership settings: plans, subscription roles, private channels, expiry behavior, announcement channel, signed webhook synchronization, and manual grants
- NFT/Web3 settings: EVM chain, contract, ERC-721/ERC-1155 token rules, minimum balance, verification role, private channels, recheck interval, and notifications
- Birthday settings: announcement channel, message template, timezone, and upcoming-day window
- Server Stats settings: statistic type, channel name template, category, and enablement
- Temporary Voice settings: join lobby, category, name template, bitrate, and user limit
- Automation settings: ordered triggers, conditions, actions, cooldowns, stop-processing behavior, dry-run testing, and execution history

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
- `{mention}`

Bluesky uses its public author-feed API. Reddit uses the OAuth Data API when credentials are
configured and can otherwise use a feed bridge URL. TikTok, X, Instagram, and Kick require a
public RSS, Atom, JSON Feed, or compatible API bridge URL because their official public read APIs
require additional access or authentication. Podcast notifications accept standard RSS, Atom, or
JSON Feed URLs.

Automation messages support:

- `{user}`, `{userId}`, `{username}`, and `{displayName}`
- `{channel}`, `{channelId}`, `{messageId}`, and `{content}`
- `{emoji}`, `{addedRoles}`, and `{removedRoles}`
- `{server}` and `{rule}`

## Completed Scope

All requested phases in `Task.md` are now represented in the bot runtime, dashboard UI, shared validation layer, Prisma schema, README, and Docker Compose setup. Social alerts are intentionally conservative on first run: the worker records the latest item as a baseline, then posts future changes. Use `/social-alert test` to send the current latest item manually.
