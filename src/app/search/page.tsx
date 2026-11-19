"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Label, SearchField } from "@heroui/react";
import { useLB } from "@/lib/use-lb";
import { fmtDate, fmtInt } from "@/lib/format";
import { releaseGroupCover } from "@/lib/listen";
import { CoverArt, Empty, ErrorNote, Link, NavTabs, Page, Panel, SkeletonRows, UserLink } from "@/components/ui";
import { ListenRows } from "@/components/entity/entity-parts";
import { creditName, creditsToRefs, mbGet } from "@/components/entity/mb";
import { mbRecordingToListen } from "@/components/entity/data";

type SearchType = "artist" | "album" | "track" | "playlist" | "user";

const TYPES: Array<{ key: SearchType; label: string; noun: string }> = [
  { key: "artist", label: "Artists", noun: "artists" },
  { key: "album", label: "Albums", noun: "albums" },
  { key: "track", label: "Tracks", noun: "tracks" },
  { key: "playlist", label: "Playlists", noun: "playlists" },
  { key: "user", label: "Users", noun: "users" },
];

const PAGE = 25;

type MBArtistHit = {
  id: string;
  name: string;
  disambiguation?: string;
  type?: string;
  country?: string;
  area?: { name: string } | null;
  "life-span"?: { begin?: string; end?: string; ended?: boolean };
};

type MBReleaseGroupHit = {
  id: string;
  title: string;
  "primary-type"?: string;
  "secondary-types"?: string[];
  "first-release-date"?: string;
  "artist-credit"?: Parameters<typeof creditsToRefs>[0];
};

type MBRecordingHit = {
  id: string;
  title: string;
  length?: number | null;
  "artist-credit"?: Parameters<typeof creditsToRefs>[0];
  releases?: Array<{ id: string; title?: string; "release-group"?: { id: string } }>;
};

type Result =
  | { kind: "artist"; total: number; items: MBArtistHit[] }
  | { kind: "album"; total: number; items: MBReleaseGroupHit[] }
  | { kind: "track"; total: number; items: MBRecordingHit[] }
  | { kind: "playlist"; total: number; items: Array<{ mbid: string; title: string; creator: string; date: string }> }
  | { kind: "user"; total: number; items: string[] };

const yearOf = (d?: string) => (d ? d.slice(0, 4) : undefined);

export default function SearchPageWrapper() {
  return (
    <React.Suspense fallback={null}>
      <SearchPage />
    </React.Suspense>
  );
}

function SearchPage() {
  const router = useRouter();
  const params = useSearchParams();
  const q = (params.get("q") ?? "").trim();
  const rawType = params.get("type");
  const type: SearchType = TYPES.some((t) => t.key === rawType) ? (rawType as SearchType) : "artist";
  const offset = Math.max(0, Number(params.get("offset")) || 0);
  const typeInfo = TYPES.find((t) => t.key === type) ?? TYPES[0];

  // The field follows the URL when the query changes (e.g. from the top bar search).
  const inputRef = React.useRef<HTMLInputElement>(null);
  // With no query the field is focused so the user can type straight away.
  React.useEffect(() => {
    if (!q) inputRef.current?.focus();
  }, [q]);

  const [draft, setDraft] = React.useState(q);
  const [shownQ, setShownQ] = React.useState(q);
  if (shownQ !== q) {
    setShownQ(q);
    setDraft(q);
  }

  const go = (next: { q: string; type: SearchType; offset?: number }) => {
    const sp = new URLSearchParams({ q: next.q, type: next.type });
    if (next.offset) sp.set("offset", String(next.offset));
    router.push(`/search?${sp.toString()}`);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = draft.trim();
    if (!term) return;
    go({ q: term, type });
  };

  const result = useLB(q ? ["search", type, q, offset] : null, async (apiClient): Promise<Result> => {
    switch (type) {
      case "artist": {
        const r = await mbGet<{ count: number; artists: MBArtistHit[] }>("artist", {
          query: q,
          limit: PAGE,
          offset,
        });
        return { kind: "artist", total: r.count, items: r.artists ?? [] };
      }
      case "album": {
        const r = await mbGet<{ count: number; "release-groups": MBReleaseGroupHit[] }>("release-group", {
          query: q,
          limit: PAGE,
          offset,
        });
        return { kind: "album", total: r.count, items: r["release-groups"] ?? [] };
      }
      case "track": {
        const r = await mbGet<{ count: number; recordings: MBRecordingHit[] }>("recording", {
          query: q,
          limit: PAGE,
          offset,
        });
        return { kind: "track", total: r.count, items: r.recordings ?? [] };
      }
      case "playlist": {
        const r = await apiClient.searchPlaylists(q, PAGE, offset);
        return {
          kind: "playlist",
          total: r.playlist_count ?? r.count ?? 0,
          items: (r.playlists ?? []).map(({ playlist }) => ({
            mbid: playlist.identifier.split("/").pop() ?? "",
            title: playlist.title,
            creator: playlist.creator,
            date: playlist.date,
          })),
        };
      }
      case "user": {
        const r = await apiClient.searchUsers(q);
        const users = (r.users ?? []).map((u) => u.user_name);
        return { kind: "user", total: users.length, items: users };
      }
    }
  });

  const data = result.data;
  const totalLabel = data ? `${fmtInt(data.total)} found` : undefined;
  const hasPaging = data && data.kind !== "user";
  const rangeLabel =
    hasPaging && data.total > 0
      ? `${fmtInt(offset + 1)}–${fmtInt(Math.min(offset + PAGE, data.total))} of ${fmtInt(data.total)}`
      : totalLabel;

  return (
    <Page
      title="Search"
      subtitle={q ? `Results for “${q}”` : undefined}
    >
      <form role="search" onSubmit={submit} className="flex flex-col gap-3">
        <SearchField name="q" value={draft} onChange={setDraft} className="w-full">
          <Label className="sr-only">Search ListenBrainz and MusicBrainz</Label>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input
              ref={inputRef}
              placeholder="Artists, albums, tracks, playlists or users"
              className="w-full"
            />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </form>

      <NavTabs
        active={type}
        items={TYPES.map((t) => ({
          key: t.key,
          label: t.label,
          href: `/search?${new URLSearchParams({ q, type: t.key }).toString()}`,
        }))}
      />

      {!q ? (
        <p className="pt-2 text-[14px] text-ink-2">
          Type an artist, album, track, playlist or user name above to search.
        </p>
      ) : result.isLoading && !data ? (
        <Panel>
          <SkeletonRows rows={6} cover={type === "album" || type === "track"} />
        </Panel>
      ) : result.error ? (
        <ErrorNote error={result.error} onRetry={() => result.mutate()} />
      ) : !data || data.total === 0 || !data.items.length ? (
        <Empty>
          No {typeInfo.noun} match “{q}”.
        </Empty>
      ) : (
        <Panel aside={rangeLabel}>
          {data.kind === "artist" ? (
            <ul className="flex flex-col">
              {data.items.map((a) => {
                const life = a["life-span"];
                const detail = [
                  a.disambiguation,
                  a.type,
                  a.area?.name ?? a.country,
                  life?.begin ? `${life.begin}${life.ended || life.end ? `–${life.end ?? ""}` : "–"}` : undefined,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li key={a.id} className="min-w-0 py-2.5">
                    <Link href={`/artist/${a.id}`} className="block truncate text-[14px] font-medium">
                      {a.name}
                    </Link>
                    {detail ? <div className="truncate text-[12px] text-ink-3">{detail}</div> : null}
                  </li>
                );
              })}
            </ul>
          ) : null}

          {data.kind === "album" ? (
            <ul className="flex flex-col">
              {data.items.map((rg) => {
                const credits = creditsToRefs(rg["artist-credit"]);
                const detail = [
                  rg["primary-type"],
                  ...(rg["secondary-types"] ?? []),
                  yearOf(rg["first-release-date"]),
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li key={rg.id} className="flex items-center gap-3 py-2">
                    <CoverArt src={releaseGroupCover(rg.id, 250)} alt={rg.title} size={48} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/album/${rg.id}`} className="block truncate text-[14px] font-medium">
                        {rg.title}
                      </Link>
                      <div className="truncate text-[13px] text-ink-2">
                        {creditName(credits) || "Unknown artist"}
                        {detail ? <span className="text-ink-3"> · {detail}</span> : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {data.kind === "track" ? (
            <TrackResults recordings={data.items} />
          ) : null}

          {data.kind === "playlist" ? (
            <ul className="flex flex-col">
              {data.items.map((p) => (
                <li key={p.mbid} className="min-w-0 py-2.5">
                  <Link href={`/playlist/${p.mbid}`} className="block truncate text-[14px] font-medium">
                    {p.title || "Untitled playlist"}
                  </Link>
                  <div className="truncate text-[12px] text-ink-3">
                    {[p.creator, p.date ? fmtDate(p.date) : undefined].filter(Boolean).join(" · ")}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {data.kind === "user" ? (
            <ul className="flex flex-col">
              {data.items.map((name) => (
                <li key={name} className="py-2">
                  <UserLink name={name} avatar />
                </li>
              ))}
            </ul>
          ) : null}

          {hasPaging && data.total > PAGE ? (
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#1f1f1f] pt-3">
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => go({ q, type, offset: Math.max(0, offset - PAGE) })}
                className="h-9 rounded-full px-4 text-[13px] text-ink-2 transition-colors hover:text-white disabled:opacity-40"
              >
                Newer
              </button>
              <span className="num text-[12px] text-ink-3">
                Page {fmtInt(Math.floor(offset / PAGE) + 1)} of {fmtInt(Math.ceil(data.total / PAGE))}
              </span>
              <button
                type="button"
                disabled={offset + PAGE >= data.total}
                onClick={() => go({ q, type, offset: offset + PAGE })}
                className="h-9 rounded-full px-4 text-[13px] text-ink-2 transition-colors hover:text-white disabled:opacity-40"
              >
                Older
              </button>
            </div>
          ) : null}
        </Panel>
      )}
    </Page>
  );
}

/** Recording search hits as ListenCards (play, love/hate, queue) with the release as the album. */
function TrackResults({ recordings }: { recordings: MBRecordingHit[] }) {
  const listens = React.useMemo(
    () => recordings.map((r) => mbRecordingToListen(r, r.releases?.[0])),
    [recordings]
  );
  return (
    <div className="-mx-2">
      <ListenRows listens={listens} />
    </div>
  );
}

