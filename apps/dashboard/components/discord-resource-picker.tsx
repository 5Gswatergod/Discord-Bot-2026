"use client";

import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import type {
  DiscordChannelResource,
  DiscordGuildResources,
  DiscordRoleResource
} from "@/types/discord-resources";

type DiscordResourcesState = {
  data: DiscordGuildResources | null;
  loading: boolean;
  error: string | null;
};

type SinglePickerProps = {
  value: string;
  onValueChange: (value: string) => void;
  allowEmpty?: boolean;
  disabled?: boolean;
  className?: string;
};

type MultiPickerProps = {
  values: string[];
  onValuesChange: (values: string[]) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
};

const DiscordResourcesContext = createContext<DiscordResourcesState | null>(null);
const textChannelTypes = new Set([0, 5, 15, 16]);
const selectClassName =
  "h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50";

function isDiscordGuildResources(value: unknown): value is DiscordGuildResources {
  return (
    typeof value === "object" &&
    value !== null &&
    "channels" in value &&
    Array.isArray(value.channels) &&
    "roles" in value &&
    Array.isArray(value.roles)
  );
}

export function DiscordResourcesProvider({
  guildId,
  children
}: {
  guildId: string;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<DiscordResourcesState>({
    data: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadResources() {
      try {
        const response = await fetch(`/api/guilds/${guildId}/discord-resources`, {
          signal: controller.signal
        });
        const body = (await response.json().catch(() => null)) as unknown;

        if (!response.ok || !isDiscordGuildResources(body)) {
          const errorMessage =
            typeof body === "object" &&
            body !== null &&
            "error" in body &&
            typeof body.error === "string"
              ? body.error
              : "無法載入 Discord 資源。";

          throw new Error(errorMessage);
        }

        setState({
          data: body,
          loading: false,
          error: null
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          data: null,
          loading: false,
          error: error instanceof Error ? error.message : "無法載入 Discord 資源。"
        });
      }
    }

    void loadResources();
    return () => controller.abort();
  }, [guildId]);

  return (
    <DiscordResourcesContext.Provider value={state}>
      {state.error ? (
        <div
          role="alert"
          className="rounded-md border border-amber-500/30 bg-amber-400/10 p-3 text-sm text-amber-800 dark:text-amber-200"
        >
          {state.error}
        </div>
      ) : null}
      {children}
    </DiscordResourcesContext.Provider>
  );
}

function useDiscordResources() {
  const context = useContext(DiscordResourcesContext);

  if (!context) {
    throw new Error("Discord resource pickers must be used inside DiscordResourcesProvider");
  }

  return context;
}

function channelLabel(channel: DiscordChannelResource) {
  const prefix = textChannelTypes.has(channel.type) ? "#" : channel.type === 2 ? "語音" : "頻道";
  const location = channel.parentName ? `${channel.parentName} / ` : "";

  return `${prefix} ${location}${channel.name}`;
}

function roleLabel(role: DiscordRoleResource) {
  if (role.managed) {
    return `${role.name}（由 Discord 管理）`;
  }

  if (!role.assignable) {
    return `${role.name}（機器人無法指派）`;
  }

  return role.name;
}

export function DiscordChannelSelect({
  value,
  onValueChange,
  allowEmpty = true,
  disabled,
  className
}: SinglePickerProps) {
  const { data, loading } = useDiscordResources();
  const channels = data?.channels.filter((channel) => textChannelTypes.has(channel.type)) ?? [];
  const missingValue = value && !channels.some((channel) => channel.id === value);

  return (
    <select
      className={cn(selectClassName, className)}
      value={value}
      disabled={disabled || loading || !data}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {allowEmpty ? <option value="">不指定</option> : null}
      {!allowEmpty && !value && !loading ? (
        <option value="" disabled>
          請選擇頻道
        </option>
      ) : null}
      {loading ? <option value="">正在載入頻道...</option> : null}
      {missingValue ? <option value={value}>已刪除或無法存取的頻道</option> : null}
      {channels.map((channel) => (
        <option key={channel.id} value={channel.id}>
          {channelLabel(channel)}
        </option>
      ))}
    </select>
  );
}

export function DiscordCategorySelect({
  value,
  onValueChange,
  allowEmpty = true,
  disabled,
  className
}: SinglePickerProps) {
  const { data, loading } = useDiscordResources();
  const categories = data?.channels.filter((channel) => channel.type === 4) ?? [];
  const missingValue = value && !categories.some((channel) => channel.id === value);

  return (
    <select
      className={cn(selectClassName, className)}
      value={value}
      disabled={disabled || loading || !data}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {allowEmpty ? <option value="">不指定</option> : null}
      {!allowEmpty && !value && !loading ? (
        <option value="" disabled>
          請選擇分類
        </option>
      ) : null}
      {loading ? <option value="">正在載入分類...</option> : null}
      {missingValue ? <option value={value}>已刪除或無法存取的分類</option> : null}
      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </select>
  );
}

export function DiscordRoleSelect({
  value,
  onValueChange,
  allowEmpty = true,
  disabled,
  assignableOnly = false,
  className
}: SinglePickerProps & { assignableOnly?: boolean }) {
  const { data, loading } = useDiscordResources();
  const roles = data?.roles.filter((role) => !assignableOnly || role.assignable) ?? [];
  const missingValue = value && !roles.some((role) => role.id === value);

  return (
    <select
      className={cn(selectClassName, className)}
      value={value}
      disabled={disabled || loading || !data}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {allowEmpty ? <option value="">不指定</option> : null}
      {!allowEmpty && !value && !loading ? (
        <option value="" disabled>
          請選擇身分組
        </option>
      ) : null}
      {loading ? <option value="">正在載入身分組...</option> : null}
      {missingValue ? <option value={value}>已刪除或機器人無法使用的身分組</option> : null}
      {roles.map((role) => (
        <option key={role.id} value={role.id}>
          {roleLabel(role)}
        </option>
      ))}
    </select>
  );
}

export function DiscordChannelMultiSelect(props: MultiPickerProps) {
  const { data, loading } = useDiscordResources();

  return (
    <ResourceMultiSelect
      {...props}
      disabled={props.disabled || !data}
      items={data?.channels.filter((channel) => textChannelTypes.has(channel.type)) ?? []}
      loading={loading}
      itemLabel={channelLabel}
      emptyLabel="選擇頻道"
      searchLabel="搜尋頻道"
      missingLabel="已刪除或無法存取的頻道"
    />
  );
}

export function DiscordRoleMultiSelect({
  assignableOnly = false,
  ...props
}: MultiPickerProps & { assignableOnly?: boolean }) {
  const { data, loading } = useDiscordResources();

  return (
    <ResourceMultiSelect
      {...props}
      disabled={props.disabled || !data}
      items={data?.roles.filter((role) => !assignableOnly || role.assignable) ?? []}
      loading={loading}
      itemLabel={roleLabel}
      emptyLabel="選擇身分組"
      searchLabel="搜尋身分組"
      missingLabel="已刪除或無法使用的身分組"
    />
  );
}

function ResourceMultiSelect<T extends { id: string }>({
  values,
  onValuesChange,
  ariaLabel,
  items,
  loading,
  itemLabel,
  emptyLabel,
  searchLabel,
  missingLabel,
  disabled,
  className
}: MultiPickerProps & {
  items: T[];
  loading: boolean;
  itemLabel: (item: T) => string;
  emptyLabel: string;
  searchLabel: string;
  missingLabel: string;
}) {
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-Hant");

    if (!normalizedQuery) {
      return items;
    }

    return items.filter((item) =>
      itemLabel(item).toLocaleLowerCase("zh-Hant").includes(normalizedQuery)
    );
  }, [itemLabel, items, query]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function toggleValue(value: string) {
    onValuesChange(
      values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
    );
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        className={cn(selectClassName, "flex items-center justify-between gap-2 text-left")}
        disabled={disabled || loading}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate text-muted-foreground">
          {loading ? "正在載入..." : values.length > 0 ? `已選擇 ${values.length} 項` : emptyLabel}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>

      {values.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {values.map((value, index) => {
            const item = itemMap.get(value);

            return (
              <button
                key={value}
                type="button"
                className="inline-flex max-w-full items-center gap-1 rounded-sm border border-border bg-muted px-2 py-1 text-xs text-foreground"
                onClick={() => toggleValue(value)}
                title="移除"
              >
                <span className="truncate">
                  {item ? itemLabel(item) : `${missingLabel} ${index + 1}`}
                </span>
                <X className="h-3 w-3 shrink-0" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      ) : null}

      {open ? (
        <div
          id={panelId}
          className="absolute z-50 mt-2 w-full min-w-64 rounded-md border border-border bg-card p-2 shadow-panel"
        >
          <label className="flex h-9 items-center gap-2 rounded-md border border-border bg-input px-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">{searchLabel}</span>
            <input
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchLabel}
              autoFocus
            />
          </label>
          <div className="mt-2 max-h-64 overflow-y-auto">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => {
                const selected = values.includes(item.id);

                return (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => toggleValue(item.id)}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border"
                      )}
                    >
                      {selected ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
                    </span>
                    <span className="truncate">{itemLabel(item)}</span>
                  </button>
                );
              })
            ) : (
              <p className="px-2 py-3 text-sm text-muted-foreground">找不到符合的項目。</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
