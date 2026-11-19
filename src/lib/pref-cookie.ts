/*
  The two player preferences ListenBrainz has no field for (volume, "submit listens while playing"),
  kept in one cookie in your browser. Undertone's server never reads it: it is only used by the page.
*/

const NAME = "undertone_prefs";
const ONE_YEAR = 365 * 24 * 60 * 60;

export type LocalPrefs = { volume: number; submitListens: boolean };

const DEFAULTS: LocalPrefs = { volume: 80, submitListens: true };

export function readPrefCookie(): LocalPrefs {
  if (typeof document === "undefined") return DEFAULTS;
  const raw = document.cookie.split("; ").find((c) => c.startsWith(`${NAME}=`))?.slice(NAME.length + 1);
  if (!raw) return DEFAULTS;
  try {
    const v = JSON.parse(decodeURIComponent(raw)) as Partial<LocalPrefs>;
    return {
      volume: typeof v.volume === "number" && v.volume >= 0 && v.volume <= 100 ? Math.round(v.volume) : DEFAULTS.volume,
      submitListens: typeof v.submitListens === "boolean" ? v.submitListens : DEFAULTS.submitListens,
    };
  } catch {
    return DEFAULTS;
  }
}

export function writePrefCookie(patch: Partial<LocalPrefs>) {
  if (typeof document === "undefined") return;
  const next = { ...readPrefCookie(), ...patch };
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${NAME}=${encodeURIComponent(JSON.stringify(next))}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax${secure}`;
}
