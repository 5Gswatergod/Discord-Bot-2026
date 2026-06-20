# 快速 Production 部署

Production images 由 GitHub Actions 建置並發布到 GHCR。Oracle VM 不再執行
Next.js、TypeScript 或 Prisma Client 編譯，只負責拉取 image、同步 schema 與重啟應用程式。

## 發布的 images

- `ghcr.io/5gswatergod/discord-bot-2026-bot:sha-<40-character-commit>`
- `ghcr.io/5gswatergod/discord-bot-2026-dashboard:sha-<40-character-commit>`
- `latest` 只代表最新的 `master` build，不用於正式部署或回滾。

`master` push 通過 typecheck、lint、test 與 application build 後，Bot 和 Dashboard
會在 GitHub-hosted runners 平行建置。Pull request 也會建置兩個 Docker targets，但不會發布。

## 一次性 GitHub 設定

1. Push 本次變更並等待 `CI` workflow 第一次發布兩個 packages。
2. 到 GitHub package settings 確認兩個 container packages 都是 **Public**。GitHub
   通常會讓以 `GITHUB_TOKEN` 建立且連結公開 repository 的 package 繼承公開權限；
   若 package 顯示 Private，手動執行 `Package settings > Change visibility > Public`。
   公開 GHCR container 可以讓 VM 匿名 pull，且改為 Public 後無法再改回 Private。
3. 建立專用部署 SSH key，不要重用個人登入 key：

   ```bash
   ssh-keygen -t ed25519 -C guildforge-github-actions -f guildforge-actions
   ssh-copy-id -i guildforge-actions.pub ubuntu@YOUR_VM_IP
   ssh-keyscan -H YOUR_VM_IP
   ```

4. 在 repository 的 `Settings > Environments` 建立 `production` environment。
5. 建議為 `production` 設定 required reviewer，讓每次部署都必須人工批准。
6. 在 `production` environment 建立以下 secrets：

   | Secret | 內容 |
   | --- | --- |
   | `DEPLOY_HOST` | VM IP 或 hostname |
   | `DEPLOY_USER` | `ubuntu` |
   | `DEPLOY_SSH_KEY` | `guildforge-actions` private key 完整內容 |
   | `DEPLOY_KNOWN_HOSTS` | `ssh-keyscan -H` 產生的完整行 |

Workflow 使用固定路徑 `/home/ubuntu/Discord-Bot-2026`。VM 上的 repository 必須位於此處、
保持在 `master`，且 tracked files 不可有未提交修改。Production secrets 繼續只保存在 VM
的 `.env`，不會傳入 GitHub build。

## 正式部署

1. Push 到 `master`，等待 `CI` 成功。
2. 到 `Actions > Deploy Production > Run workflow`。
3. 一般部署將 `image_tag` 留白，workflow 會部署
   `sha-<workflow-selected-commit>`。
4. GitHub approval 通過後，workflow 會：
   - 在 VM 執行 fast-forward-only `git pull`，取得最新版 Compose 與部署腳本。
   - 匿名拉取 Bot 與 Dashboard immutable images。
   - 使用新 Dashboard image 執行 `db:push`。
   - 只更新 Dashboard，等待 health check。
   - 只更新 Bot，確認 30 秒內保持 running 且未重啟。
   - 將成功 tag 原子寫入 VM 的 `.deploy.env`。

Caddy、PostgreSQL 與 Redis 不會重啟。`.deploy.env` 和 `.deploy.lock` 已加入
`.gitignore`。

## 回滾與失敗處理

- Image pull 或 `db:push` 失敗時，現有 application containers 不會變更。
- Dashboard health check 或 Bot stability check 失敗時，腳本會自動切回
  `.deploy.env` 記錄的上一個 immutable tag。
- 首次導入且尚無 `.deploy.env` 時，腳本會替目前兩個 container images 建立暫時的
  local rollback tags。
- Prisma schema 不會自動降版，因此 schema 變更必須與前一版 application 相容。
- 不可使用 `db push --accept-data-loss`。

手動回滾時，在 `Deploy Production` workflow 的 `image_tag` 輸入完整舊 tag，例如：

```text
sha-0123456789abcdef0123456789abcdef01234567
```

正式 workflow 會拒絕 `latest`、短 SHA 與其他可變 tag。

## Slash commands

一般部署不會呼叫 Discord command registration API。指令結構變更後，到
`Actions > Register Production Slash Commands > Run workflow`：

- `image_tag` 留白：使用 `.deploy.env` 的目前 production tag。
- 指定完整 immutable tag：使用該 Bot image 註冊，但不切換正在運行的 Bot。

## VM 緊急備援

只有 GHCR 或 GitHub Actions 無法使用時才在 1 GB VM 本機建置，而且必須依序執行：

```bash
cd /home/ubuntu/Discord-Bot-2026
git pull --ff-only origin master
docker compose -f docker-compose.oracle.yml build bot
docker compose -f docker-compose.oracle.yml build dashboard
docker compose -f docker-compose.oracle.yml up -d --no-deps --no-build --pull never bot
docker compose -f docker-compose.oracle.yml up -d --no-deps --no-build --pull never dashboard
```

不可執行平行的 `docker compose build bot dashboard`。本機備援不會更新
`.deploy.env`，恢復 GHCR 部署後應再次執行正式 workflow。

## 驗證

```bash
cat .deploy.env
docker compose -f docker-compose.oracle.yml ps
curl --fail --silent --show-error https://YOUR_DOMAIN/api/health
docker compose -f docker-compose.oracle.yml logs --tail=100 dashboard bot
```

正常狀態下 Dashboard、PostgreSQL、Redis 顯示 healthy，Bot 與 Caddy 顯示 running。
