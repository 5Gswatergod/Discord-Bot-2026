"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  web3TokenStandards,
  type Web3CollectionInput,
  type Web3Settings
} from "@guildforge/shared";

import {
  DiscordChannelMultiSelect,
  DiscordChannelSelect,
  DiscordRoleSelect
} from "@/components/discord-resource-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type DashboardWeb3Wallet = {
  id: string;
  userId: string;
  address: string;
  verifiedAt: string | null;
  eligibleCount: number;
  errorCount: number;
};

function blankCollection(index: number): Web3CollectionInput {
  return {
    key: `collection-${index + 1}`,
    name: "新 NFT 收藏",
    chainId: 1,
    contractAddress: "",
    standard: "ERC721",
    tokenId: null,
    minimumBalance: 1,
    roleId: "",
    privateChannelIds: [],
    enabled: true
  };
}

export function Web3SettingsForm({
  guildId,
  settings,
  wallets
}: {
  guildId: string;
  settings: Web3Settings;
  wallets: DashboardWeb3Wallet[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = useState(settings);
  const [message, setMessage] = useState<string | null>(null);

  function update(index: number, data: Partial<Web3CollectionInput>) {
    setLocal((current) => ({
      ...current,
      collections: current.collections.map((collection, collectionIndex) =>
        collectionIndex === index ? { ...collection, ...data } : collection
      )
    }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch(`/api/guilds/${guildId}/web3`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(local)
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;

    setMessage(response.ok ? "已儲存 Web3 設定。" : (body?.error ?? "無法儲存 Web3 設定。"));
    if (response.ok) startTransition(() => router.refresh());
  }

  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-medium">
          驗證公告頻道
          <DiscordChannelSelect
            value={local.announcementChannelId ?? ""}
            onValueChange={(announcementChannelId) =>
              setLocal((current) => ({
                ...current,
                announcementChannelId: announcementChannelId || null
              }))
            }
          />
        </label>
        <label className="grid gap-2 text-sm font-medium md:col-span-2">
          驗證成功訊息
          <Input
            value={local.verificationMessage}
            onChange={(event) =>
              setLocal((current) => ({
                ...current,
                verificationMessage: event.target.value
              }))
            }
          />
          <span className="text-xs font-normal text-muted-foreground">
            可使用：{"{user}"}、{"{collection}"}
          </span>
        </label>
      </div>
      <label className="grid max-w-xs gap-2 text-sm font-medium">
        重新驗證間隔（小時）
        <Input
          type="number"
          min={1}
          max={168}
          value={local.recheckHours}
          onChange={(event) =>
            setLocal((current) => ({
              ...current,
              recheckHours: Number(event.target.value)
            }))
          }
        />
      </label>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">NFT 收藏條件</p>
          <p className="text-xs text-muted-foreground">
            成員使用 `/wallet challenge` 與 `/wallet verify` 完成錢包簽章。
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setLocal((current) => ({
              ...current,
              collections: [
                ...current.collections,
                blankCollection(current.collections.length)
              ]
            }))
          }
        >
          <Plus size={14} aria-hidden="true" />
          新增收藏
        </Button>
      </div>
      {local.collections.map((collection, index) => (
        <div
          key={`${collection.key}-${index}`}
          className="grid gap-4 rounded-lg border border-border p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium">{collection.name}</p>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="刪除 NFT 收藏"
              onClick={() =>
                setLocal((current) => ({
                  ...current,
                  collections: current.collections.filter(
                    (_, collectionIndex) => collectionIndex !== index
                  )
                }))
              }
            >
              <Trash2 size={16} aria-hidden="true" />
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-medium">
              收藏代碼
              <Input
                value={collection.key}
                onChange={(event) => update(index, { key: event.target.value })}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              顯示名稱
              <Input
                value={collection.name}
                onChange={(event) => update(index, { name: event.target.value })}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Chain ID
              <Input
                type="number"
                min={1}
                value={collection.chainId}
                onChange={(event) => update(index, { chainId: Number(event.target.value) })}
              />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            合約地址
            <Input
              value={collection.contractAddress}
              onChange={(event) => update(index, { contractAddress: event.target.value })}
              placeholder="0x..."
            />
          </label>
          <div className="grid gap-4 md:grid-cols-4">
            <label className="grid gap-2 text-sm font-medium">
              Token 標準
              <select
                className="h-10 rounded-md border border-border bg-input px-3 text-sm"
                value={collection.standard}
                onChange={(event) =>
                  update(index, {
                    standard: event.target.value as Web3CollectionInput["standard"],
                    tokenId: event.target.value === "ERC721" ? null : collection.tokenId
                  })
                }
              >
                {web3TokenStandards.map((standard) => (
                  <option key={standard} value={standard}>
                    {standard}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Token ID
              <Input
                disabled={collection.standard === "ERC721"}
                value={collection.tokenId ?? ""}
                onChange={(event) => update(index, { tokenId: event.target.value || null })}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              最低持有數量
              <Input
                type="number"
                min={1}
                value={collection.minimumBalance}
                onChange={(event) =>
                  update(index, { minimumBalance: Number(event.target.value) })
                }
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              驗證身分組
              <DiscordRoleSelect
                value={collection.roleId}
                allowEmpty={false}
                assignableOnly
                onValueChange={(roleId) => update(index, { roleId })}
              />
            </label>
          </div>
          <div className="grid gap-2 text-sm font-medium">
            私人頻道
            <DiscordChannelMultiSelect
              ariaLabel={`${collection.name} 私人頻道`}
              values={collection.privateChannelIds}
              onValuesChange={(privateChannelIds) =>
                update(index, { privateChannelIds })
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={collection.enabled}
              onChange={(event) => update(index, { enabled: event.target.checked })}
            />
            啟用收藏驗證
          </label>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          <Save size={16} aria-hidden="true" />
          儲存
        </Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
      <div className="border-t border-border pt-5">
        <p className="mb-3 text-sm font-semibold">已連結錢包</p>
        <div className="grid gap-2">
          {wallets.length > 0 ? (
            wallets.map((wallet) => (
              <div key={wallet.id} className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium">
                  {wallet.userId} · {wallet.address}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {wallet.verifiedAt ? "簽章已驗證" : "等待簽章"} · 符合 {wallet.eligibleCount} 項 ·
                  錯誤 {wallet.errorCount} 項
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">目前尚無已連結錢包。</p>
          )}
        </div>
      </div>
    </form>
  );
}
