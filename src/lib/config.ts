/** Public ListenBrainz API root. Override with NEXT_PUBLIC_LB_API_URL for a self-hosted server. */
export const LB_API_URL =
  process.env.NEXT_PUBLIC_LB_API_URL ?? "https://api.listenbrainz.org";

/** The canonical ListenBrainz website, for things only its own session can do (OAuth links, account deletion). */
export const LB_WEB_URL =
  process.env.NEXT_PUBLIC_LB_WEB_URL ?? "https://listenbrainz.org";

export const MB_URL = "https://musicbrainz.org";
export const CAA_URL = "https://coverartarchive.org";

export const PRODUCT_NAME = "Undertone";

/** Undertone's own source code. */
export const REPO_URL = "https://github.com/foxgirlsorg/undertone";
