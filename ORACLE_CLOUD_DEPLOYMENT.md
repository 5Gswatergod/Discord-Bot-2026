# Hydrava Oracle Cloud Always Free 部署教學

本文件說明如何將 Hydrava 部署到 Oracle Cloud Infrastructure（OCI）Always Free Compute。

部署架構：

- Oracle Cloud Ubuntu VM
- Docker Engine 與 Docker Compose
- Hydrava Dashboard
- Discord Bot
- PostgreSQL
- Redis
- Caddy HTTPS reverse proxy

所有應用程式與資料服務都會運行在同一台 VM。PostgreSQL 與 Redis 不會直接開放到網際網路。

## 1. 免費方案說明

Oracle Cloud Always Free Compute 目前包含：

- 最多兩台 `VM.Standard.E2.1.Micro` AMD VM
- Ampere A1 `VM.Standard.A1.Flex` 的免費 OCPU 與記憶體額度

依 Oracle 官方說明，Ampere A1 的 Always Free 額度約等同 2 OCPU 與 12 GB RAM。實際可建立的資源和可用區域仍以 OCI Console 顯示為準。

建議使用：

```txt
Shape: VM.Standard.A1.Flex
OCPU: 2
Memory: 12 GB
Image: Ubuntu 24.04 LTS
```

如果區域暫時沒有 Ampere A1 容量，可以：

- 稍後重試
- 改用其他 Availability Domain
- 選擇 Always Free AMD `VM.Standard.E2.1.Micro`

AMD Micro 的記憶體較少，建置 Next.js 時可能不足。若使用 AMD Micro，建議先在其他電腦建置 image，或設定 swap。

`VM.Standard.E2.1.Micro` 只有 1 GB RAM。使用本專案時建議至少設定 4 GB swap，並一次只建置一個 image，以降低建置期間記憶體不足的機率：

```bash
docker compose -f docker-compose.oracle.yml build bot
docker compose -f docker-compose.oracle.yml build dashboard
```

## 2. 準備項目

你需要：

- Oracle Cloud 帳號
- GitHub 帳號
- Discord Developer Portal Application
- 一個可以指向 VM Public IP 的 domain

domain 可以是：

- 自己購買的 domain
- Cloudflare DNS 管理的 domain
- DuckDNS 等免費 DNS 服務提供的 subdomain

Caddy 需要 domain 正確指向 VM，才能自動取得 HTTPS certificate。

## 3. 建立 Discord Application

前往 [Discord Developer Portal](https://discord.com/developers/applications)。

1. 點選 **New Application**。
2. 建立 Application。
3. 從 **General Information** 複製 Application ID。
4. 從 **OAuth2** 複製 Client Secret。
5. 從 **Bot** 建立 Bot 並複製 Bot Token。

部署時會使用：

| 環境變數                | Discord 值           |
| ----------------------- | -------------------- |
| `DISCORD_CLIENT_ID`     | Application ID       |
| `DISCORD_CLIENT_SECRET` | OAuth2 Client Secret |
| `DISCORD_BOT_TOKEN`     | Bot Token            |

### 啟用 Gateway Intents

在 Discord Developer Portal 的 **Bot** 頁面啟用：

- **Server Members Intent**
- **Message Content Intent**

Hydrava 的 welcome、leveling、AutoMod、custom commands 和部分 logging 功能需要這些 intents。

## 4. 建立 Oracle Cloud VM

1. 登入 [Oracle Cloud Console](https://cloud.oracle.com/)。
2. 開啟 **Compute > Instances**。
3. 點選 **Create instance**。
4. 輸入 instance 名稱，例如 `guildforge`。
5. Image 選擇 Ubuntu 24.04 LTS。
6. Shape 選擇標示 **Always Free eligible** 的 shape。
7. 建議選擇 Ampere `VM.Standard.A1.Flex`、2 OCPU、12 GB RAM。
8. 建立新的 VCN 或使用既有 VCN。
9. 確認 VM 具有 Public IPv4 address。
10. 加入自己的 SSH public key，或下載 Oracle 產生的 private key。
11. 建立 VM。

記下 VM 的 Public IP，例如：

```txt
203.0.113.10
```

## 5. 設定 OCI 防火牆

Oracle Cloud 的 Security List 或 Network Security Group 需要允許：

| 用途  | Protocol | Port | Source            |
| ----- | -------- | ---- | ----------------- |
| SSH   | TCP      | 22   | 建議只允許你的 IP |
| HTTP  | TCP      | 80   | `0.0.0.0/0`       |
| HTTPS | TCP      | 443  | `0.0.0.0/0`       |

設定 Security List：

1. 開啟 VM 詳細資料。
2. 點選 Primary VNIC 的 Subnet。
3. 開啟該 Subnet 使用的 Security List。
4. 點選 **Add Ingress Rules**。
5. 新增 TCP 80 和 TCP 443。

不要開放：

- PostgreSQL `5432`
- Redis `6379`

這兩個服務只需要在 Docker network 內使用。

## 6. 設定 Domain

在 DNS 服務新增 A record：

| Type | Name           | Value               |
| ---- | -------------- | ------------------- |
| A    | 你的 subdomain | Oracle VM Public IP |

例如：

```txt
bot.example.com -> 203.0.113.10
```

等待 DNS 生效後，在本機確認：

```bash
nslookup bot.example.com
```

回傳的 IP 應與 Oracle VM Public IP 相同。

如果使用 Cloudflare，初次申請 Caddy certificate 時建議先將 DNS record 設為 **DNS only**。

## 7. SSH 連線

Ubuntu image 的預設使用者通常是 `ubuntu`：

```bash
ssh -i /path/to/private-key ubuntu@203.0.113.10
```

Windows PowerShell 範例：

```powershell
ssh -i C:\Keys\oracle.key ubuntu@203.0.113.10
```

首次連線時確認 host fingerprint。

## 8. 更新系統與設定 Swap

更新 Ubuntu：

```bash
sudo apt update
sudo apt upgrade -y
```

Ampere A1 12 GB RAM 通常不需要 swap。若 VM 記憶體較小，可建立 2 GB swap：

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

確認：

```bash
free -h
```

## 9. 安裝 Docker Engine

使用 Docker 官方 apt repository：

```bash
sudo apt remove -y docker.io docker-compose docker-compose-v2 docker-doc podman-docker containerd runc
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

啟用 Docker：

```bash
sudo systemctl enable --now docker
sudo docker run --rm hello-world
```

允許目前使用者執行 Docker：

```bash
sudo usermod -aG docker $USER
```

登出 SSH 並重新連線，然後確認：

```bash
docker version
docker compose version
```

`docker` group 具有接近 root 的權限，只應加入可信任的系統使用者。

## 10. 安裝 Git 並下載專案

```bash
sudo apt install -y git
git clone https://github.com/YOUR_NAME/YOUR_REPOSITORY.git
cd YOUR_REPOSITORY
```

私人 repository 建議使用 GitHub deploy key 或 fine-grained personal access token。

## 11. 建立 Production 環境變數

從範例建立 `.env`：

```bash
cp .env.example .env
nano .env
```

至少設定：

```env
DISCORD_CLIENT_ID="你的 Discord Application ID"
DISCORD_CLIENT_SECRET="你的 Discord OAuth Client Secret"
DISCORD_BOT_TOKEN="你的 Discord Bot Token"
DISCORD_TEST_GUILD_ID=""
DISCORD_BOT_PERMISSIONS="8"

NEXTAUTH_SECRET="使用 openssl 產生"
APP_DOMAIN="bot.example.com"

POSTGRES_PASSWORD="使用 openssl 產生"

TWITCH_CLIENT_ID=""
TWITCH_ACCESS_TOKEN=""
GUILD_SYNC_LIMIT="100"
```

產生安全值：

```bash
openssl rand -hex 32
```

分別執行兩次，一個填入 `NEXTAUTH_SECRET`，另一個填入 `POSTGRES_PASSWORD`。

`POSTGRES_PASSWORD` 建議使用英文字母與數字組成的 hex 值，避免 DATABASE URL 需要額外 URL encoding。

Oracle production Compose 會自動設定：

```env
DATABASE_URL=postgresql://guildforge:...@postgres:5432/guildforge
REDIS_URL=redis://redis:6379
NEXTAUTH_URL=https://APP_DOMAIN
APP_URL=https://APP_DOMAIN
```

不需要將 `.env` 上傳到 GitHub。

限制 `.env` 權限：

```bash
chmod 600 .env
```

## 12. 啟動 Hydrava

建置 images：

```bash
docker compose -f docker-compose.oracle.yml build
```

第一次啟動資料服務：

```bash
docker compose -f docker-compose.oracle.yml up -d postgres redis
```

套用 Prisma schema：

```bash
docker compose -f docker-compose.oracle.yml run --rm dashboard corepack pnpm db:push
```

啟動完整服務：

```bash
docker compose -f docker-compose.oracle.yml up -d
```

查看狀態：

```bash
docker compose -f docker-compose.oracle.yml ps
```

查看 logs：

```bash
docker compose -f docker-compose.oracle.yml logs -f dashboard bot caddy
```

按 `Ctrl+C` 只會離開 log 畫面，不會停止 containers。

## 13. 設定 Ubuntu 防火牆

除了 OCI Security List，VM 本身也可能有防火牆。

使用 UFW：

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

啟用 UFW 前務必先允許 OpenSSH，否則可能失去 SSH 連線。

## 14. 設定 Discord OAuth Redirect

Caddy 成功取得 certificate 後，Dashboard URL 為：

```txt
https://bot.example.com
```

在 Discord Developer Portal：

1. 開啟 Application。
2. 前往 **OAuth2**。
3. 在 Redirects 新增：

```txt
https://bot.example.com/api/auth/callback/discord
```

4. 儲存。

Redirect domain 必須與 `.env` 的 `APP_DOMAIN` 完全一致。

## 15. 註冊 Slash Commands

執行：

```bash
docker compose -f docker-compose.oracle.yml exec bot corepack pnpm --filter @guildforge/bot register
```

設定 `DISCORD_TEST_GUILD_ID` 時，指令只會註冊到該測試伺服器，更新較快。

未設定時會註冊 global commands，Discord 可能需要一段時間才會顯示。

## 16. 邀請 Bot

部署完成後：

1. 開啟 `https://你的-domain`。
2. 使用 Discord 登入。
3. 選擇具有 Manage Server 權限的 guild。
4. 使用 Dashboard 的 Invite Bot 連結。

目前 `DISCORD_BOT_PERMISSIONS=8` 代表 Administrator，方便完整測試。正式環境可以改成較小的權限集合。

Bot role 必須：

- 位於需要管理的角色之上
- 可以查看及傳送目標頻道
- 具有 Manage Roles、Manage Messages、Moderate Members 等功能所需權限

## 17. 部署後測試

### HTTPS 與 Dashboard

```bash
curl -I https://bot.example.com
```

### Health Check

```bash
curl https://bot.example.com/api/health
```

正常時：

```json
{
  "ok": true
}
```

### Containers

```bash
docker compose -f docker-compose.oracle.yml ps
```

`postgres`、`redis`、`dashboard` 應顯示 healthy，`bot` 和 `caddy` 應顯示 running。

### Discord

測試：

```txt
/ping
/serverinfo
/userinfo
```

接著從 Dashboard 啟用並測試其他 modules。

## 18. 更新程式

```bash
cd YOUR_REPOSITORY
git pull
docker compose -f docker-compose.oracle.yml build
docker compose -f docker-compose.oracle.yml run --rm dashboard corepack pnpm db:push
docker compose -f docker-compose.oracle.yml up -d
docker image prune -f
```

需要更新 slash commands 時：

```bash
docker compose -f docker-compose.oracle.yml exec bot corepack pnpm --filter @guildforge/bot register
```

## 19. 備份 PostgreSQL

建立備份：

```bash
mkdir -p backups
docker compose -f docker-compose.oracle.yml exec -T postgres \
  pg_dump -U guildforge -d guildforge > backups/guildforge-$(date +%F).sql
```

建議將備份另外下載到本機或上傳至安全的 object storage。只留在同一台 VM 上不算完整備份。

還原前先停止 Dashboard 和 Bot：

```bash
docker compose -f docker-compose.oracle.yml stop dashboard bot
cat backups/your-backup.sql | \
  docker compose -f docker-compose.oracle.yml exec -T postgres \
  psql -U guildforge -d guildforge
docker compose -f docker-compose.oracle.yml start dashboard bot
```

## 20. 常見問題

### 無法建立 Ampere A1 VM

代表目前 Availability Domain 沒有免費容量。可更換 Availability Domain、稍後重試，或先使用 AMD Always Free shape。

### 網頁無法連線

檢查：

```bash
docker compose -f docker-compose.oracle.yml ps
docker compose -f docker-compose.oracle.yml logs caddy dashboard
sudo ufw status
```

並確認 OCI Security List 已開 TCP 80 和 443。

### Caddy 無法取得 HTTPS certificate

確認：

- `APP_DOMAIN` 沒有包含 `https://`
- domain A record 指向正確 Public IP
- TCP 80、443 已開放
- Cloudflare proxy 暫時設為 DNS only

### OAuth callback error

確認：

- `.env` 的 `APP_DOMAIN`
- Discord OAuth Redirect
- 瀏覽器實際開啟的 domain

三者完全一致。

### Dashboard health check 回傳 503

查看：

```bash
docker compose -f docker-compose.oracle.yml logs postgres dashboard
```

重新套用 schema：

```bash
docker compose -f docker-compose.oracle.yml run --rm dashboard corepack pnpm db:push
```

### Docker build 在 `db:generate` 顯示缺少 `DATABASE_URL`

先更新 repository：

```bash
git pull
```

新版 Dockerfile 會在 Prisma Client 產生階段使用 build-only placeholder URL，不會連線資料庫，也不會把 production database password 寫入 image。

重新建置且不使用舊 cache：

```bash
docker compose -f docker-compose.oracle.yml build --no-cache
docker compose -f docker-compose.oracle.yml up -d
```

真正的 `DATABASE_URL` 只會在 container 啟動時由 `docker-compose.oracle.yml` 注入。

### Prisma 顯示無法偵測 OpenSSL

常見訊息：

```txt
Prisma failed to detect the libssl/openssl version
Could not parse schema engine response
```

新版 `Dockerfile` 已改用 Debian Bookworm Slim，並在 image 內安裝 `openssl` 與 `ca-certificates`。更新 repository 後重新建置：

```bash
git pull
docker compose -f docker-compose.oracle.yml build --no-cache bot
docker compose -f docker-compose.oracle.yml build dashboard
```

確認 image 內可以讀取 OpenSSL：

```bash
docker compose -f docker-compose.oracle.yml run --rm dashboard openssl version
```

接著再執行：

```bash
docker compose -f docker-compose.oracle.yml run --rm dashboard corepack pnpm db:push
```

### Bot 無法啟動

```bash
docker compose -f docker-compose.oracle.yml logs bot
```

常見原因：

- Discord Bot Token 錯誤
- Gateway Intents 未啟用
- PostgreSQL 尚未 ready
- `.env` 格式錯誤

### Slash commands 沒有出現

重新執行：

```bash
docker compose -f docker-compose.oracle.yml exec bot corepack pnpm --filter @guildforge/bot register
```

測試期間建議設定 `DISCORD_TEST_GUILD_ID`。

## 21. 安全建議

- 不要將 `.env`、private SSH key 或 Bot Token 提交到 Git。
- SSH port 22 建議只允許自己的 Public IP。
- 不要對外開放 PostgreSQL 5432 或 Redis 6379。
- 定期執行 Ubuntu 和 Docker security updates。
- Discord Token 洩漏時立即重設。
- 定期建立離機資料庫備份。
- Oracle Always Free 不代表服務有正式 SLA，重要服務應準備付費方案或其他備援。

## 官方文件

- [OCI Always Free Resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- [建立 OCI Compute Instance](https://docs.oracle.com/iaas/Content/Compute/Tasks/launchinginstance.htm)
- [OCI Security Lists](https://docs.oracle.com/iaas/Content/Network/Concepts/securitylists.htm)
- [Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [Docker Linux Post-installation](https://docs.docker.com/engine/install/linux-postinstall/)
- [Docker Compose](https://docs.docker.com/compose/install/)
