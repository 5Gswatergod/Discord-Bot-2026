你是一位資深 Full-Stack Discord Bot 工程師。請建立一個類似 MEE6 / Meet6 類型的 Discord 社群管理系統，但不要使用 MEE6 的品牌、名稱、UI、商標或任何受保護素材。目標是做出一個「可自架、模組化、可用 Web Dashboard 管理」的 Discord Bot。

參考功能方向：MEE6 類型機器人常見功能包含 moderation、leveling、reaction roles、welcome messages、custom commands、Twitch / YouTube alerts、giveaways、server statistics、dashboard 管理等。MEE6 官方與 Discord App Directory 也列出 moderation、leveling、reaction roles、Twitch / YouTube alerts 等核心能力。請以這些作為功能範圍參考，但實作成原創產品。 

請將專案分成兩大部分：

====================================================
一、Discord Bot 本身
====================================================

技術要求：
- 使用 TypeScript
- 使用 discord.js v14
- 使用 PostgreSQL + Prisma ORM
- 使用 Redis 做快取與 cooldown
- 使用 Slash Commands 為主
- 支援多伺服器 multi-guild
- 每個 guild 都有獨立設定
- 所有功能都要模組化，可開關
- 提供 .env.example
- 提供完整 README
- 提供 Docker Compose：bot、dashboard、postgres、redis

Bot 核心功能：

1. Moderation 管理
- /ban
- /kick
- /timeout
- /warn
- /warnings
- /clear
- /mute
- /unmute
- /slowmode
- /lock
- /unlock
- 支援 reason
- 支援 moderator log
- 支援自動記錄誰執行、對誰執行、時間、原因
- 權限檢查：只有指定角色或 Discord 權限者可使用

2. Auto Moderation
- 禁止髒話
- 禁止 spam
- 禁止連結
- 禁止大量 mention
- 禁止 invite links
- 重複訊息偵測
- caps lock 偵測
- 可設定處罰方式：
  - delete message
  - warn
  - timeout
  - kick
  - ban
- 可設定忽略頻道、忽略角色

3. Leveling / XP 系統
- 使用者發訊息獲得 XP
- cooldown 防止刷 XP
- 等級公式可設定
- /rank 顯示個人等級
- /leaderboard 顯示排行榜
- 可設定 level up message
- 可設定指定等級給予角色獎勵
- 可關閉特定頻道 XP
- 可重設單人或全伺服器 XP

4. Welcome / Goodbye
- 新成員加入歡迎訊息
- 成員離開通知
- 可設定頻道
- 可設定文字模板
- 支援變數：
  - {user}
  - {username}
  - {server}
  - {memberCount}
- 可選擇 embed 或 plain text
- 可設定自動給予新人角色

5. Reaction Roles / Button Roles
- 管理員可建立 reaction role message
- 支援 emoji reaction
- 支援 Discord buttons
- 支援 single role / multiple roles
- 支援 toggle role
- 支援互斥群組，例如只能選一個顏色身份組
- Dashboard 可視覺化建立

6. Custom Commands
- 可建立自訂 slash command 或 prefix command
- 指令可回覆文字、embed、圖片連結
- 可設定 cooldown
- 可設定可用角色
- 可設定可用頻道
- 支援變數：
  - {user}
  - {server}
  - {channel}
  - {memberCount}

7. Logging 系統
- 訊息刪除
- 訊息編輯
- 成員加入
- 成員離開
- 成員被 ban
- 成員被 unban
- 角色新增 / 移除
- 頻道新增 / 刪除
- 語音加入 / 離開
- moderation actions
- 每種 log 可指定不同頻道

8. Giveaways
- /giveaway create
- /giveaway end
- /giveaway reroll
- 支援獎品、時間、得獎人數
- 支援指定角色才可參加
- 使用 button 參加
- 自動抽獎並公告

9. Polls
- /poll create
- 支援 2 到 10 個選項
- 支援 anonymous / public
- 支援 button 投票
- 顯示投票結果

10. Social Alerts
- YouTube 新影片通知
- Twitch 開台通知
- RSS feed 通知
- 可設定通知頻道與訊息模板
- 使用排程 worker 定期檢查

11. Utility
- /serverinfo
- /userinfo
- /avatar
- /ping
- /roleinfo
- /channelinfo

====================================================
二、Web 管理面板 Dashboard
====================================================

技術要求：
- 使用 Next.js 14 App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- NextAuth.js / Auth.js
- Discord OAuth2 登入
- 使用 Prisma 連接同一個 PostgreSQL
- Dashboard 只能顯示使用者有 Manage Guild 權限的伺服器
- 所有 API Route 都要檢查權限
- UI 要乾淨、現代化、接近 SaaS 管理後台

Dashboard 頁面：

1. Login Page
- 使用 Discord OAuth2 登入
- 登入後顯示可管理的伺服器列表

2. Guild Selector
- 顯示使用者可管理的 Discord servers
- 顯示 bot 是否已加入該 server
- 如果尚未加入，提供 Invite Bot 按鈕

3. Server Overview
- 顯示伺服器名稱、icon、成員數
- 顯示 bot 狀態
- 顯示啟用中的模組
- 顯示近期 moderation log
- 顯示近期成員加入數據

4. Module Settings
每個模組都要有 enable / disable：
- Moderation
- Auto Moderation
- Leveling
- Welcome
- Reaction Roles
- Custom Commands
- Logging
- Giveaways
- Polls
- Social Alerts

5. Moderation Settings
- 設定 moderator roles
- 設定 log channel
- 設定 mute role
- 設定預設 timeout 時長
- 查看 warning records

6. AutoMod Settings
- 開關 banned words
- 編輯 banned words list
- spam detection 設定
- link filter 設定
- invite link filter 設定
- punishment 設定
- ignored roles / channels

7. Leveling Settings
- 開關 XP 系統
- 設定 XP per message
- 設定 cooldown
- 設定 level up channel
- 設定 level up message
- 設定 role rewards
- 查看 leaderboard

8. Welcome Settings
- 設定 welcome channel
- 設定 welcome message
- 設定 goodbye channel
- 設定 goodbye message
- 設定 auto role
- 提供 live preview

9. Reaction Roles Builder
- 建立 reaction role panel
- 選擇 channel
- 編輯 embed title / description / color
- 新增 emoji / button 對應 role
- 支援 single-select / multi-select
- 支援發布到 Discord

10. Custom Commands Builder
- 建立、編輯、刪除 custom command
- 設定名稱、描述、回覆內容
- 設定 cooldown
- 設定 allowed roles / channels
- 支援 embed builder

11. Logging Settings
- 每種事件可選擇開關
- 每種事件可指定 log channel

12. Giveaways Page
- 建立 giveaway
- 查看進行中 giveaway
- 手動結束
- reroll winner

13. Social Alerts Page
- 新增 YouTube channel
- 新增 Twitch channel
- 新增 RSS feed
- 設定通知頻道
- 設定通知模板

====================================================
資料庫設計
====================================================

請建立 Prisma schema，至少包含：

- User
- Guild
- GuildConfig
- ModuleConfig
- ModerationCase
- Warning
- AutoModRule
- LevelingUser
- LevelReward
- WelcomeConfig
- ReactionRolePanel
- ReactionRoleOption
- CustomCommand
- LogConfig
- Giveaway
- GiveawayEntry
- Poll
- PollOption
- PollVote
- SocialAlert
- AuditLog

每個資料表都要支援 guildId，確保多伺服器隔離。

====================================================
安全性要求
====================================================

- 不要把 Discord Bot Token 暴露到前端
- 所有 Dashboard API 必須驗證使用者是否有管理該 guild 的權限
- 使用 CSRF / session protection
- Bot commands 必須檢查 Discord permissions
- 防止 rate limit 問題
- 對使用者輸入做 validation
- 使用 zod 做 API validation
- Error handling 要完整
- Logging 不要記錄敏感 token

====================================================
專案結構
====================================================

請使用 monorepo：

/apps
  /bot
  /dashboard

/packages
  /database
  /shared
  /config

其他：
- 使用 pnpm workspace
- 使用 ESLint + Prettier
- 使用 tsconfig base
- 使用 Docker Compose
- 提供 seed script
- 提供 migration 指令
- 提供 dev / build / start scripts

====================================================
開發順序
====================================================

請依照以下順序實作：

Phase 1:
- 建立 monorepo
- 建立 Prisma schema
- 建立 Discord bot 基礎架構
- 建立 Dashboard 登入與 Guild Selector

Phase 2:
- 實作 Moderation
- 實作 Logging
- 實作 Welcome

Phase 3:
- 實作 Leveling
- 實作 AutoMod
- 實作 Custom Commands

Phase 4:
- 實作 Reaction Roles
- 實作 Giveaways
- 實作 Polls

Phase 5:
- 實作 Social Alerts
- 完成 Dashboard UI
- 完成 README
- 完成 Docker 部署

====================================================
輸出要求
====================================================

請直接產生完整可執行的專案程式碼。
不要只給片段。
每個檔案都要有清楚路徑。
如果內容太多，請分階段輸出，但每一階段都要能成功執行。
優先確保架構正確、資料庫設計完整、權限安全、可擴充。