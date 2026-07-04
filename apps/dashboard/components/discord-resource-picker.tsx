"use client";

import { Check, ChevronsUpDown, Loader2, RefreshCw, Search, X } from "lucide-react";
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
  retrying: boolean;
  canRetry: boolean;
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
const resourceRetryDelaysMs = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000];
const selectClassName =
  "h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50";

type ResourceLoadError = Error & {
  status?: number;
  retryable?: boolean;
};

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

function getApiErrorMessage(body: unknown) {
  return typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
    ? body.error
    : "無法載入 Discord 資源。";
}

function isRetryableResourceStatus(status: number | null) {
  return status === null || status === 408 || status === 409 || status === 429 || status >= 500;
}

async function fetchDiscordGuildResources(guildId: string, signal: AbortSignal) {
  const response = await fetch(`/api/guilds/${guildId}/discord-resources`, {
    signal
  });
  const body = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const error = new Error(getApiErrorMessage(body)) as ResourceLoadError;
    error.status = response.status;
    error.retryable = isRetryableResourceStatus(response.status);
    throw error;
  }

  if (!isDiscordGuildResources(body)) {
    const error = new Error("Discord 資源格式不完整，正在重新確認。") as ResourceLoadError;
    error.retryable = true;
    throw error;
  }

  return body;
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
    error: null,
    retrying: false,
    canRetry: false
  });
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    async function loadResources(attempt: number) {
      setState((current) => ({
        data: null,
        loading: true,
        error: attempt === 0 ? null : current.error,
        retrying: attempt > 0,
        canRetry: false
      }));

      try {
        const body = await fetchDiscordGuildResources(guildId, controller.signal);

        setState({
          data: body,
          loading: false,
          error: null,
          retrying: false,
          canRetry: false
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        const resourceError = error as ResourceLoadError;
        const errorMessage =
          resourceError instanceof Error ? resourceError.message : "無法載入 Discord 資源。";
        const shouldRetry = resourceError.retryable ?? true;

        if (shouldRetry) {
          const delay =
            resourceRetryDelaysMs[Math.min(attempt, resourceRetryDelaysMs.length - 1)] ??
            resourceRetryDelaysMs[resourceRetryDelaysMs.length - 1];

          setState({
            data: null,
            loading: false,
            error: errorMessage,
            retrying: true,
            canRetry: true
          });

          retryTimer = setTimeout(() => {
            void loadResources(attempt + 1);
          }, delay);
          return;
        }

        setState({
          data: null,
          loading: false,
          error: errorMessage,
          retrying: false,
          canRetry: true
        });
      }
    }

    void loadResources(0);
    return () => {
      controller.abort();

      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, [guildId, retryKey]);

  function retryNow() {
    setRetryKey((current) => current + 1);
  }

  return (
    <DiscordResourcesContext.Provider value={state}>
      {state.data ? children : <DiscordResourcesGate state={state} onRetry={retryNow} />}
    </DiscordResourcesContext.Provider>
  );
}

function DiscordResourcesGate({
  state,
  onRetry
}: {
  state: DiscordResourcesState;
  onRetry: () => void;
}) {
  const title =
    state.error && !state.retrying && !state.loading
      ? "無法確認 Discord 資源存取權"
      : state.error
        ? "正在重新確認 Discord 資源存取權"
        : "正在載入 Discord 資源";
  const description = state.error
    ? state.retrying
      ? "暫時無法存取頻道或身分組，系統會自動重試。"
      : "暫時無法存取頻道或身分組。"
    : "確認頻道、分類與身分組可存取後，才會顯示設定表單。";

  return (
    <section className="rounded-lg border border-border bg-card p-5 text-sm shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <Loader2
            className={cn(
              "mt-0.5 h-5 w-5 shrink-0 text-primary",
              state.loading || state.retrying ? "animate-spin" : ""
            )}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="font-medium text-foreground">{title}</p>
            <p className="mt-1 leading-6 text-muted-foreground">{description}</p>
            {state.error ? (
              <p className="mt-2 leading-6 text-amber-700 dark:text-amber-200">
                {state.error}
              </p>
            ) : null}
          </div>
        </div>
        {state.canRetry ? (
          <button
            type="button"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            onClick={onRetry}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            立即重試
          </button>
        ) : null}
      </div>
    </section>
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

export function DiscordVoiceChannelSelect({
  value,
  onValueChange,
  allowEmpty = true,
  disabled,
  className
}: SinglePickerProps) {
  const { data, loading } = useDiscordResources();
  const channels = data?.channels.filter((channel) => channel.type === 2) ?? [];
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
          請選擇語音頻道
        </option>
      ) : null}
      {loading ? <option value="">正在載入語音頻道...</option> : null}
      {missingValue ? <option value={value}>已刪除或無法存取的語音頻道</option> : null}
      {channels.map((channel) => (
        <option key={channel.id} value={channel.id}>
          {channelLabel(channel)}
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
