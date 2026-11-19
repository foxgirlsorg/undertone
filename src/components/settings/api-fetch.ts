/*
  Small fetch helpers for endpoints the official APIService does not cover (or covers awkwardly).
  Errors carry the HTTP status so screens can tell "not calculated yet" (204/404) from real failures.
*/

export class RequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "RequestError";
    this.status = status;
  }
}

/** Reads the server's readable message: JSON {error|message} or plain text. */
export async function readErrorMessage(res: Response): Promise<string> {
  const type = res.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      const body = (await res.json()) as { error?: string; message?: string };
      return body.error || body.message || res.statusText || `HTTP ${res.status}`;
    }
    const text = await res.text();
    return text.trim() || res.statusText || `HTTP ${res.status}`;
  } catch {
    return res.statusText || `HTTP ${res.status}`;
  }
}

export const authHeader = (token: string) => ({ Authorization: `Token ${token}` });

/** GET (optionally authenticated) and parse JSON. Resolves to null for 204 No Content. */
export async function apiGet<T>(url: string, token?: string): Promise<T | null> {
  const res = await fetch(url, {
    method: "GET",
    headers: token ? authHeader(token) : undefined,
  });
  if (!res.ok) throw new RequestError(await readErrorMessage(res), res.status);
  if (res.status === 204) return null;
  return (await res.json()) as T;
}

/** POST a JSON body (optionally authenticated) and parse JSON when the response has a body. */
export async function apiPostJson<T>(url: string, token: string, body?: unknown): Promise<T | null> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeader(token),
      ...(body === undefined ? {} : { "Content-Type": "application/json;charset=UTF-8" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new RequestError(await readErrorMessage(res), res.status);
  if (res.status === 204) return null;
  const type = res.headers.get("content-type") ?? "";
  return type.includes("application/json") ? ((await res.json()) as T) : null;
}

/** Unwraps the `payload` envelope some ListenBrainz endpoints use. */
export function unwrapPayload<T>(body: unknown): T {
  const b = body as { payload?: T } | T;
  return (b && typeof b === "object" && "payload" in b && b.payload !== undefined ? b.payload : b) as T;
}
