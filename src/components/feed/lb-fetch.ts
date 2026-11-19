import type APIService from "@/lib/api";

/**
 * GET a ListenBrainz path the APIService has no method for (pins/current, pins/following).
 * Throws an error carrying `response`, so `errorStatus()` from use-lb works on it.
 */
export async function lbGet<T>(api: APIService, path: string): Promise<T> {
  const res = await fetch(`${api.APIBaseURI}${path}`);
  if (!res.ok) {
    const err = new Error(`ListenBrainz answered ${res.status}`) as Error & { response?: Response; status?: string };
    err.response = res;
    err.status = String(res.status);
    throw err;
  }
  return (await res.json()) as T;
}
