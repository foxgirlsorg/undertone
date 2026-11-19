"use client";

import useSWR, { type SWRConfiguration } from "swr";
import { useAuth } from "./auth";
import type APIService from "./api";
import type { AuthUser } from "./auth";

/**
 * Data hook for any ListenBrainz call.
 *
 *   const { data, error, isLoading, mutate } = useLB(
 *     ["user-listens", username],            // cache key (null = don't fetch)
 *     (api, user) => api.getListensForUser(username, undefined, undefined, 25)
 *   );
 *
 * `user` is the signed-in user (or null) so fetchers can pass user.token where an endpoint needs auth.
 * A 404 from the stats API ("no stats yet") surfaces as `error.status === 404` / `error.response.status === 204` — render an honest empty state.
 */
export function useLB<T>(
  key: unknown[] | null,
  fetcher: (api: APIService, user: AuthUser | null) => Promise<T>,
  config?: SWRConfiguration<T>
) {
  const { api, user } = useAuth();
  const ready = user !== undefined; // wait until auth is restored
  return useSWR<T>(
    ready && key ? [...key, user?.name ?? "anon"] : null,
    () => fetcher(api, user ?? null),
    {
      revalidateOnFocus: false,
      // Retry only transient failures: a network error (ListenBrainz's rate-limit answers carry
      // no CORS header, so the browser reports them as a failed fetch) or 429/5xx. Never 4xx/204.
      onErrorRetry: (err, _key, _cfg, revalidate, { retryCount }) => {
        const status = errorStatus(err);
        const transient = err instanceof TypeError || status === 429 || (status != null && status >= 500);
        if (!transient || retryCount >= 3) return;
        setTimeout(() => revalidate({ retryCount }), 2000 * 2 ** retryCount + Math.random() * 1000);
      },
      ...config,
    }
  );
}

/** Extracts an HTTP status from an API error, if any. */
export function errorStatus(err: unknown): number | undefined {
  const e = err as { status?: string | number; response?: Response };
  if (e?.response?.status) return e.response.status;
  if (e?.status != null) return Number(e.status);
  return undefined;
}

export function errorMessage(err: unknown): string {
  if (!err) return "";
  if (err instanceof Error) return err.message;
  return String(err);
}
