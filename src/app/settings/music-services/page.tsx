"use client";

import useSWR from "swr";
import { Empty, ErrorNote, Link, Loading, Page, Pill } from "@/components/ui";
import { OutButton, SettingsGate, SettingsPanel, SettingsSection } from "@/components/settings/settings-kit";
import { apiGet } from "@/components/settings/api-fetch";
import { useApi, type AuthUser } from "@/lib/auth";
import { LB_WEB_URL } from "@/lib/config";

export default function MusicServicesSettingsPage() {
  return (
    <Page
      title="Music services"
      subtitle="Services you can connect to ListenBrainz for playback, listen syncing and playlist export."
    >
      <SettingsGate what="see your connected music services">{(user) => <ServicesArea user={user} />}</SettingsGate>
    </Page>
  );
}

type SupportedService = {
  id: string;
  label: string;
  /** Lowercase fragments that identify this service in the connected list from the API. */
  match: string[];
  what: string;
};

const SUPPORTED: SupportedService[] = [
  {
    id: "spotify",
    label: "Spotify",
    match: ["spotify"],
    what: "Syncs your recent listens and can export generated playlists. Playback needs a Premium account.",
  },
  {
    id: "apple",
    label: "Apple Music",
    match: ["apple"],
    what: "Syncs listens and plays music. Needs a subscription, and the link renews about every six months.",
  },
  {
    id: "soundcloud",
    label: "SoundCloud",
    match: ["soundcloud"],
    what: "Plays music in the player. A free account is enough.",
  },
  {
    id: "funkwhale",
    label: "Funkwhale",
    match: ["funkwhale"],
    what: "Plays music from a Funkwhale server you connect.",
  },
  {
    id: "navidrome",
    label: "Navidrome",
    match: ["navidrome"],
    what: "Plays music from a self-hosted Navidrome server you connect.",
  },
  {
    id: "lastfm",
    label: "Last.fm",
    match: ["lastfm", "last.fm"],
    what: "Imports your Last.fm scrobble history and keeps new listens in sync.",
  },
];

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z.]/g, "");

function ServicesArea({ user }: { user: AuthUser }) {
  const api = useApi();
  const { data, error, isLoading, mutate } = useSWR(
    ["user-services", user.name],
    async () => {
      const body = await apiGet<{ services?: string[]; payload?: { services?: string[] } }>(
        `${api.APIBaseURI}/user/${encodeURIComponent(user.name)}/services`,
        user.token
      );
      return body?.services ?? body?.payload?.services ?? [];
    },
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  const connected = data ?? [];
  const matched = new Set<string>();
  const rows = SUPPORTED.map((s) => {
    const hit = connected.find((c) => s.match.some((m) => normalise(c).includes(m)));
    if (hit) matched.add(hit);
    return { service: s, on: Boolean(hit) };
  });
  const unknownConnected = connected.filter((c) => !matched.has(c));

  return (
    <div>
      <SettingsSection
        title="Connected services"
        description="Managed on listenbrainz.org."
        summary={
          isLoading
            ? undefined
            : error
              ? undefined
              : connected.length
                ? `${connected.length} connected.`
                : "Nothing connected yet."
        }
      >
        <SettingsPanel className="flex flex-col gap-3">
          {isLoading ? <Loading label="Checking your connections" /> : null}
          {error ? (
            <ErrorNote error={error} onRetry={() => void mutate()} />
          ) : null}
          {data ? (
            <ul className="flex flex-col gap-2">
              {rows.map(({ service, on }) => (
                <li key={service.id} className="flex flex-wrap items-start justify-between gap-3 rounded-[10px] bg-raised px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-medium">{service.label}</span>
                      <Pill tone={on ? "positive" : "neutral"}>{on ? "Connected" : "Not connected"}</Pill>
                    </div>
                    <p className="mt-1 text-[13px] text-ink-2">{service.what}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {data && unknownConnected.length ? (
            <p className="text-[13px] text-ink-3">Also connected: {unknownConnected.join(", ")}.</p>
          ) : null}
          {data && !connected.length ? (
            <Empty>No music services are connected to your account yet.</Empty>
          ) : null}
          <div className="flex justify-end">
            <OutButton href={`${LB_WEB_URL}/settings/music-services/details/`}>Manage on listenbrainz.org</OutButton>
          </div>
        </SettingsPanel>
      </SettingsSection>

      <SettingsSection
        title="No account needed"
        description="These play in the player without connecting anything."
      >
        <SettingsPanel className="flex flex-col gap-2 text-[14px] text-ink-2">
          <p>
            <span className="text-white">YouTube</span> needs an API key to search. Add it under{" "}
            <Link href="/settings/player" className="text-white underline underline-offset-2">
              Player
            </Link>
            .
          </p>
          <p>
            <span className="text-white">Internet Archive</span> is a free public-domain archive and needs nothing.
          </p>
        </SettingsPanel>
      </SettingsSection>
    </div>
  );
}
