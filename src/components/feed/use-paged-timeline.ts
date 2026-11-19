"use client";

import * as React from "react";
import type APIService from "@/lib/api";
import { requireUser, useAuth, type AuthUser } from "@/lib/auth";
import { useLB } from "@/lib/use-lb";

export type PagedTimelineOptions<T> = {
  /** SWR key for the newest page. */
  cacheKey: string;
  fetchHead: (api: APIService, user: AuthUser) => Promise<T[]>;
  /** Items strictly older than `beforeTs` (unix seconds). */
  fetchOlder: (api: APIService, user: AuthUser, beforeTs: number) => Promise<T[]>;
  keyOf: (item: T) => string;
  /** Unix seconds of an item; older pages start from the last item's cursor. */
  cursorOf: (item: T) => number;
};

/**
 * Newest page from SWR, plus "older" pages appended locally. Pass a module-level options object
 * so the hook's memo stays stable. Refresh drops the appended pages and re-reads the newest page.
 */
export function usePagedTimeline<T>(opts: PagedTimelineOptions<T>) {
  const { api, user } = useAuth();
  const head = useLB<T[]>([opts.cacheKey], (a, u) => opts.fetchHead(a, requireUser(u)));
  const { mutate } = head;

  const [older, setOlder] = React.useState<T[]>([]);
  const [exhausted, setExhausted] = React.useState(false);
  const [loadingOlder, setLoadingOlder] = React.useState(false);
  const [olderError, setOlderError] = React.useState<unknown>(null);

  const items = React.useMemo(() => {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const it of [...(head.data ?? []), ...older]) {
      const k = opts.keyOf(it);
      if (!seen.has(k)) {
        seen.add(k);
        out.push(it);
      }
    }
    return out;
  }, [head.data, older, opts]);

  const loadOlder = React.useCallback(async () => {
    const last = items[items.length - 1];
    if (!last || !user) return;
    setLoadingOlder(true);
    setOlderError(null);
    try {
      const page = await opts.fetchOlder(api, user, opts.cursorOf(last));
      const known = new Set(items.map(opts.keyOf));
      const fresh = page.filter((it) => !known.has(opts.keyOf(it)));
      if (fresh.length === 0) setExhausted(true);
      setOlder((prev) => [...prev, ...fresh]);
    } catch (err) {
      setOlderError(err);
    } finally {
      setLoadingOlder(false);
    }
  }, [items, user, api, opts]);

  const refresh = React.useCallback(async () => {
    setOlder([]);
    setExhausted(false);
    setOlderError(null);
    await mutate();
  }, [mutate]);

  return {
    items,
    isLoading: head.isLoading,
    error: head.error as unknown,
    retry: () => void mutate(),
    refresh,
    loadOlder,
    loadingOlder,
    olderError,
    canLoadOlder: items.length > 0 && !exhausted,
  };
}
