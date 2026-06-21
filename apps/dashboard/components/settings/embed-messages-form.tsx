"use client";

import { Plus, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { EmbedMessageInput } from "@guildforge/shared";

import { DiscordChannelSelect } from "@/components/discord-resource-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function blankEmbed(): EmbedMessageInput {
  return {
    channelId: "",
    content: null,
    title: "Hydrava 公告",
    description: "在這裡輸入訊息內容。",
    color: "#24b47e",
    url: null,
    imageUrl: null,
    thumbnailUrl: null,
    footerText: null,
    authorName: null,
    enabled: true
  };
}

export function EmbedMessagesForm({
  guildId,
  messages
}: {
  guildId: string;
  messages: EmbedMessageInput[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localMessages, setLocalMessages] = useState(messages);
  const [message, setMessage] = useState<string | null>(null);

  function update(index: number, data: Partial<EmbedMessageInput>) {
    setLocalMessages((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...data } : item))
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch(`/api/guilds/${guildId}/embed-messages`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: localMessages })
    });

    setMessage(response.ok ? "已儲存，訊息會在 30 秒內發布或更新。" : "無法儲存嵌入訊息。");

    if (response.ok) {
      startTransition(() => router.refresh());
    }
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">嵌入訊息</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setLocalMessages((current) => [...current, blankEmbed()])}
        >
          <Plus size={14} aria-hidden="true" />
          新增
        </Button>
      </div>
      {localMessages.map((item, index) => (
        <div key={item.id ?? index} className="grid gap-4 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">{item.title || "新嵌入訊息"}</p>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={item.enabled}
                onChange={(event) => update(index, { enabled: event.target.checked })}
              />
              啟用同步
            </label>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="grid gap-3">
              <label className="grid gap-2 text-sm font-medium">
                發布頻道
                <DiscordChannelSelect
                  value={item.channelId}
                  allowEmpty={false}
                  onValueChange={(channelId) => update(index, { channelId })}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                一般文字
                <Textarea
                  value={item.content ?? ""}
                  onChange={(event) => update(index, { content: event.target.value || null })}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                <label className="grid gap-2 text-sm font-medium">
                  標題
                  <Input
                    value={item.title ?? ""}
                    onChange={(event) => update(index, { title: event.target.value || null })}
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  顏色
                  <Input
                    type="color"
                    value={item.color}
                    onChange={(event) => update(index, { color: event.target.value })}
                  />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-medium">
                說明
                <Textarea
                  value={item.description ?? ""}
                  onChange={(event) => update(index, { description: event.target.value || null })}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium">
                  作者名稱
                  <Input
                    value={item.authorName ?? ""}
                    onChange={(event) => update(index, { authorName: event.target.value || null })}
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  頁尾
                  <Input
                    value={item.footerText ?? ""}
                    onChange={(event) => update(index, { footerText: event.target.value || null })}
                  />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-medium">
                圖片網址
                <Input
                  type="url"
                  value={item.imageUrl ?? ""}
                  onChange={(event) => update(index, { imageUrl: event.target.value || null })}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                縮圖網址
                <Input
                  type="url"
                  value={item.thumbnailUrl ?? ""}
                  onChange={(event) => update(index, { thumbnailUrl: event.target.value || null })}
                />
              </label>
            </div>
            <div className="rounded-lg bg-[#313338] p-4 text-white">
              {item.content ? (
                <p className="mb-3 whitespace-pre-wrap text-sm">{item.content}</p>
              ) : null}
              <div
                className="rounded border-l-4 bg-[#2b2d31] p-4"
                style={{ borderLeftColor: item.color }}
              >
                {item.authorName ? (
                  <p className="text-xs font-semibold">{item.authorName}</p>
                ) : null}
                {item.title ? <p className="mt-1 font-semibold">{item.title}</p> : null}
                {item.description ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-200">
                    {item.description}
                  </p>
                ) : null}
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt="" className="mt-3 max-h-56 rounded object-cover" />
                ) : null}
                {item.footerText ? (
                  <p className="mt-3 text-xs text-zinc-400">{item.footerText}</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          <Save size={16} aria-hidden="true" />
          儲存並同步
        </Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </form>
  );
}
