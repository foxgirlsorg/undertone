"use client";

import * as React from "react";
import { mutate } from "swr";
import APIService from "./api";
import { LB_API_URL } from "./config";
import type { SessionAccount } from "./server/lb-session";
import { setSpotifyCredentials } from "./spotify";
import { setNavidromeCredentials } from "./navidrome";
import { setYoutubeApiKey } from "@/components/settings/player-prefs";

/*
  Two ways to sign in:
  - Token: the ListenBrainz user token, kept in this browser (localStorage `undertone.token`) and sent
    only to api.listenbrainz.org.
  - Password: your MetaBrainz username and password, used once by Undertone's server to log in on
    listenbrainz.org (see src/lib/server/lb-session.ts). The server keeps nothing; the listenbrainz.org
    session lives in an HttpOnly cookie in your browser. It lets Undertone read what the token can't:
    your settings and your email. That data is held in memory only.
*/

const STORAGE_KEY = "undertone.token";

export type AuthUser = { name: string; token: string };
export type { SessionAccount };

type AuthContextValue = {
  /** The shared API client (all methods of the official ListenBrainz APIService). */
  api: APIService;
  /** Signed-in user, or null. `undefined` while restoring. */
  user: AuthUser | null | undefined;
  /** Settings and email read with a password session; null without one, `undefined` while loading. */
  account: SessionAccount | null | undefined;
  /** Validates a ListenBrainz user token and stores it. Throws with a readable message when invalid. */
  signIn: (token: string) => Promise<AuthUser>;
  /** Signs in with a MetaBrainz username and password. Throws with a readable message on failure. */
  signInWithPassword: (username: string, password: string) => Promise<AuthUser>;
  /** Reads the account again from listenbrainz.org (after saving a setting, for example). */
  refreshAccount: () => Promise<void>;
  /** "Show my picture to others" (password sign-in only). Throws with a readable message on failure. */
  setAvatarShared: (shared: boolean) => Promise<void>;
  signOut: () => void;
};

const api = new APIService(LB_API_URL);

const AuthContext = React.createContext<AuthContextValue | null>(null);

async function validate(token: string): Promise<AuthUser> {
  const res = await fetch(`${api.APIBaseURI}/validate-token`, {
    headers: { Authorization: `Token ${token.trim()}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.valid) {
    throw new Error(body.message || "That token was not accepted by ListenBrainz.");
  }
  return { name: body.user_name as string, token: token.trim() };
}

/** null when there is no password session (or it ended). Throws on network trouble. */
async function fetchAccount(): Promise<SessionAccount | null> {
  const res = await fetch("/api/lb-session/account", { cache: "no-store" });
  if (res.status === 204 || res.status === 401) return null;
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't read your account.");
  return (await res.json()) as SessionAccount;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null | undefined>(undefined);
  const [account, setAccount] = React.useState<SessionAccount | null | undefined>(undefined);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      // A password session wins: it carries the token, so nothing has to be kept in localStorage.
      const acc = await fetchAccount().catch(() => null);
      if (cancelled) return;
      if (acc) {
        setAccount(acc);
        setUser({ name: acc.name, token: acc.token });
        return;
      }
      setAccount(null);
      const stored = window.localStorage.getItem(STORAGE_KEY);
      try {
        if (!stored) throw new Error("no token");
        const u = await validate(stored);
        if (!cancelled) setUser(u);
      } catch (err) {
        // A network failure (TypeError) keeps the token for next time; a rejected token is removed.
        if (!(err instanceof TypeError)) window.localStorage.removeItem(STORAGE_KEY);
        if (!cancelled) setUser(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Music-service credentials come from the ListenBrainz session and live only in memory.
  React.useEffect(() => {
    setSpotifyCredentials(account?.spotify ?? null);
    setYoutubeApiKey(account?.youtubeApiKey ?? null);
    setNavidromeCredentials(account?.navidrome ?? null);
  }, [account?.spotify, account?.youtubeApiKey, account?.navidrome]);

  const signIn = React.useCallback(async (token: string) => {
    const u = await validate(token);
    window.localStorage.setItem(STORAGE_KEY, u.token);
    setUser(u);
    return u;
  }, []);

  const signInWithPassword = React.useCallback(async (username: string, password: string) => {
    const res = await fetch("/api/lb-session/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as SessionAccount & { error?: string };
    if (!res.ok) throw new Error(body.error ?? "Sign-in failed. Try again in a moment.");
    window.localStorage.removeItem(STORAGE_KEY);
    setAccount(body);
    const u = { name: body.name, token: body.token };
    setUser(u);
    return u;
  }, []);

  const refreshAccount = React.useCallback(async () => {
    const acc = await fetchAccount();
    setAccount(acc);
  }, []);

  const setAvatarShared = React.useCallback(async (shared: boolean) => {
    const res = await fetch("/api/lb-session/avatar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shared }),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as SessionAccount & { error?: string };
    if (!res.ok) throw new Error(body.error ?? "Couldn't change that. Try again in a moment.");
    setAccount(body);
  }, []);

  const signOut = React.useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    if (account) void fetch("/api/lb-session/logout", { method: "POST" }).catch(() => {});
    setAccount(null);
    setUser(null);
    // Drop every response held in memory, so nothing fetched while signed in outlives the session.
    void mutate(() => true, undefined, { revalidate: false });
  }, [account]);

  const value = React.useMemo(
    () => ({ api, user, account, signIn, signInWithPassword, refreshAccount, setAvatarShared, signOut }),
    [user, account, signIn, signInWithPassword, refreshAccount, setAvatarShared, signOut]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Shortcut: the API client. */
export function useApi() {
  return useAuth().api;
}

/** Returns the signed-in user, or throws a readable error for actions that need one. */
export function requireUser(user: AuthUser | null | undefined): AuthUser {
  if (!user) throw new Error("Sign in with your ListenBrainz token to do this.");
  return user;
}

/** A profile picture shared through Undertone (see src/app/api/avatar). Empty (204) when there is none. */
export function sharedAvatarUrl(name: string, size = 128) {
  return `/api/avatar/${encodeURIComponent(name)}?s=${size}`;
}

/** Gravatar URL for the signed-in user's own email (only with a password session). */
export function gravatarUrl(hash: string | null | undefined, size = 160) {
  return hash ? `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404` : undefined;
}
