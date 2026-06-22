"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type {
  MembershipPlanInput,
  MembershipSettings
} from "@guildforge/shared";

import {
  DiscordChannelMultiSelect,
  DiscordChannelSelect,
  DiscordRoleSelect
} from "@/components/discord-resource-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type DashboardMembershipEntitlement = {
  id: string;
  userId: string;
  planKey: string;
  status: string;
  expiresAt: string | null;
  lastError: string | null;
};

function blankPlan(index: number): MembershipPlanInput {
  return {
    key: `plan-${index + 1}`,
    name: "新會員方案",
    roleId: "",
    privateChannelIds: [],
    enabled: true
  };
}

export function MembershipsForm({
  guildId,
  settings,
  entitlements
}: {
  guildId: string;
  settings: MembershipSettings;
  entitlements: DashboardMembershipEntitlement[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = useState(settings);
  const [message, setMessage] = useState<string | null>(null);

  function update(index: number, data: Partial<MembershipPlanInput>) {
    setLocal((current) => ({
      ...current,
      plans: current.plans.map((plan, planIndex) =>
        planIndex === index ? { ...plan, ...data } : plan
      )
    }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch(`/api/guilds/${guildId}/memberships`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(local)
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;

    setMessage(response.ok ? "已儲存會員設定。" : (body?.error ?? "無法儲存會員設定。"));
    if (response.ok) startTransition(() => router.refresh());
  }

  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-medium">
          會員公告頻道
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
        <label className="grid gap-2 text-sm font-medium">
          付款寬限天數
          <Input
            type="number"
            min={0}
            max={30}
            value={local.gracePeriodDays}
            onChange={(event) =>
              setLocal((current) => ({
                ...current,
                gracePeriodDays: Number(event.target.value)
              }))
            }
          />
        </label>
        <label className="flex items-center gap-2 self-end pb-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={local.removeRoleOnExpiry}
            onChange={(event) =>
              setLocal((current) => ({
                ...current,
                removeRoleOnExpiry: event.target.checked
              }))
            }
          />
          到期時移除會員身分組
        </label>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">會員方案</p>
          <p className="text-xs text-muted-foreground">
            金流平台可透過簽章 webhook 同步狀態；也可使用 `/membership grant` 手動授予。
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setLocal((current) => ({
              ...current,
              plans: [...current.plans, blankPlan(current.plans.length)]
            }))
          }
        >
          <Plus size={14} aria-hidden="true" />
          新增方案
        </Button>
      </div>
      {local.plans.map((plan, index) => (
        <div key={`${plan.key}-${index}`} className="grid gap-4 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium">{plan.name}</p>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="刪除會員方案"
              onClick={() =>
                setLocal((current) => ({
                  ...current,
                  plans: current.plans.filter((_, planIndex) => planIndex !== index)
                }))
              }
            >
              <Trash2 size={16} aria-hidden="true" />
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-medium">
              方案代碼
              <Input value={plan.key} onChange={(event) => update(index, { key: event.target.value })} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              顯示名稱
              <Input
                value={plan.name}
                onChange={(event) => update(index, { name: event.target.value })}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              訂閱身分組
              <DiscordRoleSelect
                value={plan.roleId}
                allowEmpty={false}
                assignableOnly
                onValueChange={(roleId) => update(index, { roleId })}
              />
            </label>
          </div>
          <div className="grid gap-2 text-sm font-medium">
            私人頻道
            <DiscordChannelMultiSelect
              ariaLabel={`${plan.name} 私人頻道`}
              values={plan.privateChannelIds}
              onValuesChange={(privateChannelIds) => update(index, { privateChannelIds })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={plan.enabled}
              onChange={(event) => update(index, { enabled: event.target.checked })}
            />
            啟用方案
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
        <p className="mb-3 text-sm font-semibold">最近會員權益</p>
        <div className="grid gap-2">
          {entitlements.length > 0 ? (
            entitlements.map((entitlement) => (
              <div key={entitlement.id} className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium">
                  {entitlement.userId} · {entitlement.planKey} · {entitlement.status}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {entitlement.expiresAt
                    ? `到期：${new Date(entitlement.expiresAt).toLocaleString("zh-TW")}`
                    : "無自動到期時間"}
                </p>
                {entitlement.lastError ? (
                  <p className="mt-1 text-xs text-destructive">{entitlement.lastError}</p>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">目前尚無會員權益。</p>
          )}
        </div>
      </div>
    </form>
  );
}
