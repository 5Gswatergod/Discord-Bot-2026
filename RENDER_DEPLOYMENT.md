# GuildForge Render.com 部署教學

本文件說明如何將 GuildForge 部署到 Render.com。部署後會建立：

- `guildforge-dashboard`：Next.js Dashboard Web Service
- `guildforge-bot`：Discord Bot Background Worker
- `guildforge-postgres`：Render Postgres
- `guildforge-redis`：Render Key Value，提供 Redis 相容連線

專案根目錄已包含 `render.yaml`，因此建議使用 Render Blueprint 一次建立所有資源。

## 1. 部署前準備

你需要：

- Render 帳號
- GitHub 帳號
- Discord Developer Portal 建立的 Application
- 已推送到 GitHub 的 GuildForge repository

請勿將 `.env`、Discord Bot Token、OAuth Client Secret 或 Twitch Token 提交到 Git。

目前 `render.yaml` 使用 Render 的付費方案：

- Dashboard Web Service：`starter`
- Bot Background Worker：`starter`
- Key Value：`starter`
- Postgres：`basic-256mb`

方案名稱、價格及可用區域可能調整。正式建立 Blueprint 前，可以依 Render Dashboard 顯示的方案修改 `render.yaml`。Render 官方不建議將 Free instance 用於正式環境。

## 2. 建立 Discord Application

前往 [Discord Developer Portal](https://discord.com/developers/applications)。

1. 點選 **New Application**。
2. 輸入名稱並建立 Application。
3. 在 **General Information** 複製 **Application ID**。
4. 在 **OAuth2** 複製或重設 **Client Secret**。
5. 在 **Bot** 頁面建立 Bot，並複製或重設 Bot Token。

稍後會把這些值填入 Render：

| Render 環境變數         | Discord 對應值       |
| ----------------------- | -------------------- |
| `DISCORD_CLIENT_ID`     | Application ID       |
| `DISCORD_CLIENT_SECRET` | OAuth2 Client Secret |
| `DISCORD_BOT_TOKEN`     | Bot Token            |

### 啟用 Gateway Intents

在 Discord Developer Portal 的 **Bot** 頁面，啟用：

- **Server Members Intent**
- **Message Content Intent**

GuildForge 的 welcome、leveling、AutoMod、custom commands 和部分 logging 功能需要這些 intents。

## 3. 推送專案到 GitHub

如果 repository 尚未初始化：

```bash
git init
git add .
git commit -m "Initial GuildForge deployment"
git branch -M main
git remote add origin https://github.com/YOUR_NAME/YOUR_REPOSITORY.git
git push -u origin main
```

如果已經有 Git repository，只需要提交並推送最新內容：

```bash
git add .
git commit -m "Prepare Render deployment"
git push
```

推送前再次確認 `.env` 沒有被提交：

```bash
git status
git ls-files .env
```

第二個指令不應顯示任何檔案。

## 4. 使用 Blueprint 建立 Render 資源

1. 登入 [Render Dashboard](https://dashboard.render.com/)。
2. 點選 **New**。
3. 選擇 **Blueprint**。
4. 連接 GitHub；私人 repository 需要授權 Render GitHub App。
5. 選擇 GuildForge repository。
6. 確認 Blueprint path 為：

```txt
render.yaml
```

7. Render 會預覽即將建立的 Web Service、Worker、Postgres、Key Value 和 Environment Group。
8. 填入 Render 要求的秘密環境變數。

## 5. 設定環境變數

Blueprint 會建立名為 `guildforge-shared` 的 Environment Group。

### 必填變數

| 變數                    | 值                           |
| ----------------------- | ---------------------------- |
| `DISCORD_CLIENT_ID`     | Discord Application ID       |
| `DISCORD_CLIENT_SECRET` | Discord OAuth2 Client Secret |
| `DISCORD_BOT_TOKEN`     | Discord Bot Token            |
| `NEXTAUTH_URL`          | Dashboard 的完整 HTTPS URL   |
| `APP_URL`               | 與 `NEXTAUTH_URL` 相同       |

`NEXTAUTH_SECRET` 會由 Render 自動產生。`DATABASE_URL` 和 `REDIS_URL` 會由 Blueprint 自動連接 Render Postgres 與 Key Value，不需要手動填寫。

Dashboard URL 通常類似：

```txt
https://guildforge-dashboard.onrender.com
```

如果 Render 因名稱衝突產生不同 URL，先完成 Blueprint 建立，再到 Environment Group 更新：

```env
NEXTAUTH_URL=https://實際的-dashboard-url.onrender.com
APP_URL=https://實際的-dashboard-url.onrender.com
```

儲存後選擇重新部署服務。

### 選填變數

| 變數                    | 用途                                 |
| ----------------------- | ------------------------------------ |
| `DISCORD_TEST_GUILD_ID` | 將 slash commands 只註冊到測試伺服器 |
| `TWITCH_CLIENT_ID`      | Twitch Social Alerts                 |
| `TWITCH_ACCESS_TOKEN`   | Twitch Social Alerts                 |
| `GUILD_SYNC_LIMIT`      | Bot 啟動時同步的 guild 數量上限      |

## 6. 設定 Discord OAuth Redirect

取得 Dashboard 實際網址後，回到 Discord Developer Portal：

1. 開啟 Application。
2. 前往 **OAuth2**。
3. 在 **Redirects** 新增：

```txt
https://你的-dashboard-url.onrender.com/api/auth/callback/discord
```

例如：

```txt
https://guildforge-dashboard.onrender.com/api/auth/callback/discord
```

4. 儲存變更。

Redirect URL 必須與 `NEXTAUTH_URL` 使用相同 domain，並且使用 HTTPS。

## 7. 等待首次部署

Dashboard 部署流程會：

1. 安裝 pnpm dependencies。
2. 產生 Prisma Client。
3. 建置 Next.js。
4. 執行 `corepack pnpm db:push`，將 Prisma schema 套用到 Render Postgres。
5. 啟動 Dashboard。
6. Render 呼叫 `/api/health` 檢查 Dashboard 與資料庫連線。

Bot Worker 部署流程會：

1. 安裝 dependencies。
2. 產生 Prisma Client。
3. 執行 TypeScript build 檢查。
4. 啟動 Discord Bot。

Render 顯示以下狀態時代表主要服務已啟動：

- Dashboard：**Live**
- Bot Worker：**Live**
- Postgres：**Available**
- Key Value：**Available**

## 8. 註冊 Discord Slash Commands

Slash commands 不會只因 Bot 上線就自動註冊，需要執行 register script。

### 方法一：在 Render Worker Shell 執行

開啟 `guildforge-bot` Worker，在 Render Shell 執行：

```bash
corepack pnpm --filter @guildforge/bot register
```

### 方法二：從本機註冊

在本機 `.env` 設定正式的 Discord credentials：

```bash
corepack pnpm install
corepack pnpm --filter @guildforge/bot register
```

若設定 `DISCORD_TEST_GUILD_ID`，指令會註冊到單一測試伺服器，更新通常很快。未設定時會註冊為 global commands；Discord 可能需要一段時間才會在所有伺服器顯示。

## 9. 邀請 Bot 到 Discord Server

部署完成後：

1. 開啟 Dashboard URL。
2. 使用 Discord 登入。
3. 在 Guild Selector 選擇伺服器。
4. 若 Bot 尚未加入，使用 Dashboard 顯示的邀請連結。

目前 `DISCORD_BOT_PERMISSIONS` 預設為 `8`，代表 Administrator。這適合完整功能測試，但正式環境可依需求改成更小的權限集合。

執行 moderation、reaction roles、logging 等功能時，請確認 Bot role：

- 位於需要管理的成員或角色之上
- 可以查看及傳送目標頻道
- 具有 Manage Roles、Manage Messages、Moderate Members 等必要權限

## 10. 部署後測試

### Dashboard

開啟：

```txt
https://你的-dashboard-url.onrender.com
```

確認：

- Discord OAuth 可以登入
- 可以看到具有 Manage Server 權限的 guild
- Bot 已加入的 guild 顯示 connected
- Module toggles 和設定可以儲存

### Health Check

開啟：

```txt
https://你的-dashboard-url.onrender.com/api/health
```

正常時應回傳：

```json
{
  "ok": true
}
```

如果回傳 HTTP `503`，通常代表 Dashboard 無法連接 Postgres。

### Discord Bot

在 Discord 測試：

```txt
/ping
/serverinfo
/userinfo
```

再依序啟用並測試 moderation、welcome、leveling、reaction roles、giveaways、polls 和 social alerts。

## 11. 自動部署與 CI

repository 已包含：

```txt
.github/workflows/ci.yml
```

CI 會執行：

```bash
corepack pnpm db:generate
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
```

`render.yaml` 使用：

```yaml
autoDeployTrigger: checksPass
```

因此推送新 commit 後，Render 會等 GitHub Actions 通過再自動部署。

如果 Render 一直顯示等待 CI：

1. 到 GitHub repository 的 **Actions** 查看失敗原因。
2. 確認 Render GitHub App 可以讀取 commit checks。
3. 測試期間可暫時將 `autoDeployTrigger` 改為 `commit`。

## 12. 常見問題

### Dashboard 顯示 OAuth callback error

確認以下三者完全一致：

- Render `NEXTAUTH_URL`
- Render `APP_URL`
- Discord OAuth Redirect 的 domain

不要在網址最後加多餘的 `/`。

### Bot Worker 啟動失敗

檢查 Worker logs，常見原因：

- `DISCORD_BOT_TOKEN` 錯誤或已重設
- `DATABASE_URL` 未正確連接 Postgres
- `REDIS_URL` 未正確連接 Key Value
- Discord privileged intents 尚未啟用

### Dashboard health check 回傳 503

確認：

- Render Postgres 狀態為 Available
- Dashboard 的 `DATABASE_URL` 是由 `guildforge-postgres` 注入
- `db:push` pre-deploy command 已成功

### Slash commands 沒有出現

重新執行：

```bash
corepack pnpm --filter @guildforge/bot register
```

測試時建議設定 `DISCORD_TEST_GUILD_ID`。Global commands 的更新不是即時的。

### Bot 無法新增 Reaction Role

將 Bot role 移到目標 role 上方，並確認 Bot 有 Manage Roles 權限。Discord 不允許 Bot 管理高於或等於自身最高 role 的角色。

### Social Alerts 沒有通知

確認：

- Dashboard 已啟用 Social Alerts module
- Alert 本身為 Enabled
- Discord channel ID 正確
- RSS/YouTube feed URL 可以公開存取
- Twitch credentials 已設定

Social Alerts 第一次檢查只會建立最新內容的 baseline，不會立即發送舊文章。可使用：

```txt
/social-alert test
```

測試目前最新項目。

## 13. 安全與維運建議

- 不要把 Render secret、Discord Token 或 `.env` 貼到 issue、log 或 commit。
- Discord Token 洩漏時立即在 Developer Portal 重設。
- 正式環境變更 Prisma schema 前先備份 Postgres。
- 定期查看 Render logs、health check 和資源使用量。
- 設定自訂 domain 後，同步更新 `NEXTAUTH_URL`、`APP_URL` 和 Discord OAuth Redirect。
- 若伺服器規模增長，升級 Dashboard、Worker、Postgres 和 Key Value 方案。

## 官方文件

- [Render Blueprints](https://render.com/docs/infrastructure-as-code)
- [Blueprint YAML Reference](https://render.com/docs/blueprint-spec)
- [Environment Variables and Secrets](https://render.com/docs/configure-environment-variables)
- [Render Service Types](https://render.com/docs/service-types)
- [Background Workers](https://render.com/docs/background-workers)
- [Render Postgres](https://render.com/docs/postgresql-creating-connecting)
- [Health Checks](https://render.com/docs/health-checks)
- [Deploys and Auto-Deploy](https://render.com/docs/deploys)
- [Custom Domains](https://render.com/docs/custom-domains)
