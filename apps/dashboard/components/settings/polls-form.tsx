"use client";

import { Plus, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { PollInput } from "@guildforge/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type PollsFormProps = {
  guildId: string;
  polls: DashboardPollInput[];
};

export type DashboardPollInput = Omit<PollInput, "endsAt"> & {
  endsAt: string | null;
};

function toDatetimeLocal(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function blankPoll(): DashboardPollInput {
  return {
    channelId: "",
    question: "Question?",
    visibility: "PUBLIC",
    endsAt: null,
    options: ["Yes", "No"]
  };
}

export function PollsForm({ guildId, polls }: PollsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localPolls, setLocalPolls] = useState(polls);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch(`/api/guilds/${guildId}/polls`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ polls: localPolls })
    });

    if (!response.ok) {
      setMessage("Failed to save polls.");
      return;
    }

    setMessage("Saved. Use /poll create to publish immediately.");
    startTransition(() => router.refresh());
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Polls</p>
        <Button type="button" size="sm" variant="outline" onClick={() => setLocalPolls((current) => [...current, blankPoll()])}>
          <Plus size={14} aria-hidden="true" />
          Add
        </Button>
      </div>
      {localPolls.map((poll, index) => (
        <div key={poll.id ?? index} className="grid gap-3 rounded-md border border-border p-3">
          <p className="text-sm font-medium">{poll.id ?? "New poll"}</p>
          <label className="grid gap-2 text-sm font-medium">
            Question
            <Textarea value={poll.question} onChange={(event) => setLocalPolls((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, question: event.target.value } : item))} />
          </label>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-medium">
              Channel ID
              <Input value={poll.channelId} onChange={(event) => setLocalPolls((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, channelId: event.target.value } : item))} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Visibility
              <select className="h-10 rounded-md border border-border bg-white px-3 text-sm" value={poll.visibility} onChange={(event) => setLocalPolls((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, visibility: event.target.value as PollInput["visibility"] } : item))}>
                <option value="PUBLIC">Public</option>
                <option value="ANONYMOUS">Anonymous</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Ends at
              <Input type="datetime-local" value={toDatetimeLocal(poll.endsAt)} onChange={(event) => setLocalPolls((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, endsAt: event.target.value ? new Date(event.target.value).toISOString() : null } : item))} />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            Options
            <Input value={poll.options.join(" | ")} onChange={(event) => setLocalPolls((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, options: event.target.value.split("|").map((option) => option.trim()).filter(Boolean) } : item))} />
          </label>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          <Save size={16} aria-hidden="true" />
          Save
        </Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </form>
  );
}
