"use client";

import { Archive, Plus, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  economyShopItemStatusLabels,
  economyShopItemStatuses,
  economyShopItemTypeLabels,
  economyShopItemTypes,
  type EconomyShopItemInput
} from "@guildforge/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type EconomyShopFormProps = {
  guildId: string;
  items: EconomyShopItemInput[];
};

function blankItem(): EconomyShopItemInput {
  return {
    name: "新商品",
    description: "",
    type: "COLLECTIBLE",
    price: 100,
    roleId: null,
    stock: null,
    soldCount: 0,
    perUserLimit: null,
    status: "DISABLED"
  };
}

export function EconomyShopForm({ guildId, items }: EconomyShopFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localItems, setLocalItems] = useState(items);
  const [message, setMessage] = useState<string | null>(null);

  function updateItem(index: number, patch: Partial<EconomyShopItemInput>) {
    setLocalItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch(`/api/guilds/${guildId}/economy/shop`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ items: localItems })
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(data?.error ?? "無法儲存商店商品。");
      return;
    }

    setMessage("已儲存。");
    startTransition(() => router.refresh());
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">商店商品</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setLocalItems((current) => [...current, blankItem()])}
        >
          <Plus size={14} aria-hidden="true" />
          新增
        </Button>
      </div>

      {localItems.map((item, index) => (
        <div key={item.id ?? index} className="grid gap-3 rounded-md border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">{item.name}</p>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              title={item.id ? "封存商品" : "移除新商品"}
              onClick={() =>
                item.id
                  ? updateItem(index, { status: "ARCHIVED" })
                  : setLocalItems((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index)
                    )
              }
            >
              <Archive size={16} aria-hidden="true" />
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-medium">
              商品名稱
              <Input
                value={item.name}
                onChange={(event) => updateItem(index, { name: event.target.value })}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              商品類型
              <select
                className="h-10 rounded-md border border-border bg-white px-3 text-sm"
                value={item.type}
                disabled={item.soldCount > 0}
                onChange={(event) =>
                  updateItem(index, {
                    type: event.target.value as EconomyShopItemInput["type"],
                    roleId: null
                  })
                }
              >
                {economyShopItemTypes.map((type) => (
                  <option key={type} value={type}>
                    {economyShopItemTypeLabels[type]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              狀態
              <select
                className="h-10 rounded-md border border-border bg-white px-3 text-sm"
                value={item.status}
                onChange={(event) =>
                  updateItem(index, {
                    status: event.target.value as EconomyShopItemInput["status"]
                  })
                }
              >
                {economyShopItemStatuses.map((status) => (
                  <option key={status} value={status}>
                    {economyShopItemStatusLabels[status]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid gap-2 text-sm font-medium">
            商品說明
            <Textarea
              value={item.description ?? ""}
              onChange={(event) => updateItem(index, { description: event.target.value })}
            />
          </label>

          <div className="grid gap-3 md:grid-cols-5">
            <label className="grid gap-2 text-sm font-medium">
              價格
              <Input
                type="number"
                min={1}
                value={item.price}
                onChange={(event) => updateItem(index, { price: Number(event.target.value) })}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              總庫存
              <Input
                type="number"
                min={item.soldCount}
                placeholder="留空為無限"
                value={item.stock ?? ""}
                onChange={(event) =>
                  updateItem(index, {
                    stock: event.target.value ? Number(event.target.value) : null
                  })
                }
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              已售數量
              <Input type="number" value={item.soldCount} disabled />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              每人上限
              <Input
                type="number"
                min={1}
                disabled={item.type === "ROLE"}
                placeholder={item.type === "ROLE" ? "固定為 1" : "留空為不限"}
                value={item.type === "ROLE" ? 1 : (item.perUserLimit ?? "")}
                onChange={(event) =>
                  updateItem(index, {
                    perUserLimit: event.target.value ? Number(event.target.value) : null
                  })
                }
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              身分組 ID
              <Input
                disabled={item.type !== "ROLE"}
                value={item.roleId ?? ""}
                onChange={(event) => updateItem(index, { roleId: event.target.value || null })}
              />
            </label>
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          <Save size={16} aria-hidden="true" />
          儲存商店
        </Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </form>
  );
}
