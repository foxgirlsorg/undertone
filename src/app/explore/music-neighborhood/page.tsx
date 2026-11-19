"use client";

import * as React from "react";
import { Suspense } from "react";
import NextLink from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input, Label, TextField } from "@heroui/react";
import { Page, Panel, Empty, ErrorNote, SkeletonRows, SignInPrompt, Loading } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useLB } from "@/lib/use-lb";
import { fmtInt } from "@/lib/format";
import { SimilarArtistsGraph } from "@/components/explore/similar-artists-graph";

/** The labs similarity algorithm the reference site uses for this page. */
const SIMILAR_ALGORITHM =
  "session_based_days_7500_session_300_contribution_5_threshold_10_limit_100_filter_True_skip_30";
const GRAPH_LIMIT = 18;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function MusicNeighborhoodPage() {
  return (
    <Suspense fallback={null}>
      <MusicNeighborhood />
    </Suspense>
  );
}

function MusicNeighborhood() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const urlArtist = searchParams.get("artist");
  const seedMBID = urlArtist && UUID.test(urlArtist) ? urlArtist.toLowerCase() : null;

  const [typed, setTyped] = React.useState("");
  const [term, setTerm] = React.useState("");

  const search = useLB(term.length > 1 ? ["mn-artist-search", term] : null, (api) =>
    api.artistLookup(term, 0, 8)
  );

  const seedInfo = useLB(seedMBID ? ["mn-artist", seedMBID] : null, (api) => api.lookupMBArtist(seedMBID as string));
  const seedName = seedInfo.data?.[0]?.name ?? "";

  const similar = useLB(seedMBID && user ? ["mn-similar", seedMBID] : null, (api, u) =>
    api.getSimilarArtists(u?.token ?? "", seedMBID as string, SIMILAR_ALGORITHM)
  );

  const artists = React.useMemo(() => {
    const list = [...(similar.data ?? [])].filter((a) => a.artist_mbid !== seedMBID);
    list.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return list.slice(0, GRAPH_LIMIT);
  }, [similar.data, seedMBID]);

  const centre = (mbid: string) => router.push(`/explore/music-neighborhood?artist=${mbid}`, { scroll: false });

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setTerm(typed.trim());
  };

  return (
    <Page
      title="Music neighborhood"
      subtitle="Choose an artist to see who sits near them. Click any node to move the graph to that artist."
    >
      <Panel>
        <form onSubmit={submitSearch} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <TextField value={typed} onChange={setTyped} name="artist" className="w-full">
            <Label>Artist</Label>
            <Input autoComplete="off" spellCheck={false} placeholder="Search MusicBrainz artists" />
          </TextField>
          <Button type="submit" variant="secondary" isDisabled={typed.trim().length < 2}>
            Search
          </Button>
        </form>

        {term.length > 1 ? (
          <div className="mt-4">
            {search.isLoading ? (
              <Loading label="Searching" />
            ) : search.error ? (
              <ErrorNote error={search.error} onRetry={() => search.mutate()} />
            ) : (search.data?.artists ?? []).length === 0 ? (
              <Empty>No artists match “{term}”.</Empty>
            ) : (
              <ul className="flex flex-col">
                {(search.data?.artists ?? []).map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setTerm("");
                        setTyped("");
                        centre(a.id);
                      }}
                      className="flex w-full min-h-[44px] items-center justify-between gap-3 rounded-[12px] px-3 text-left hover:bg-[#161616]"
                    >
                      <span className="min-w-0 truncate">{a.name}</span>
                      <span className="flex-none text-[13px] text-ink-3">
                        {[a.type, a.country, a.disambiguation].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </Panel>

      {!seedMBID ? (
        <Empty>Search for an artist above to start the graph.</Empty>
      ) : !user && user !== undefined ? (
        <SignInPrompt what="see artists in this neighbourhood" />
      ) : (
        <div className="grid gap-[14px] lg:grid-cols-6">
          <Panel className="lg:col-span-4" bodyClassName="flex justify-center">
            {similar.isLoading || seedInfo.isLoading ? (
              <Loading label="Mapping the neighbourhood" />
            ) : similar.error ? (
              <div className="w-full">
                <ErrorNote error={similar.error} onRetry={() => similar.mutate()} />
              </div>
            ) : artists.length === 0 ? (
              <Empty>No similar artists found for this one yet.</Empty>
            ) : (
              <SimilarArtistsGraph
                seed={{ artist_mbid: seedMBID, name: seedName || "Artist" }}
                artists={artists.map((a) => ({ artist_mbid: a.artist_mbid, name: a.name, score: a.score }))}
                onCentre={centre}
              />
            )}
          </Panel>

          <Panel
            className="lg:col-span-2"
            title="Nearest artists"
            aside={!similar.isLoading && artists.length ? <span className="num">{fmtInt(artists.length)}</span> : null}
          >
            {similar.isLoading ? (
              <SkeletonRows rows={6} cover={false} pitch={44} />
            ) : artists.length === 0 ? (
              <p className="text-[13px] text-ink-3">Nothing to list yet.</p>
            ) : (
              <ol className="flex flex-col">
                {artists.map((a, i) => (
                  <li key={a.artist_mbid} className="flex min-h-[44px] items-center gap-2 rounded-[10px] px-2 hover:bg-[#161616]">
                    <span className="num w-5 flex-none text-right text-[12px] text-ink-3">{i + 1}</span>
                    <NextLink href={`/artist/${a.artist_mbid}`} className="min-w-0 flex-1 truncate text-[14px] hover:text-data">
                      {a.name}
                    </NextLink>
                    <span className="num flex-none text-[12px] text-ink-2">{formatScore(a.score)}</span>
                    <Button size="sm" variant="tertiary" onPress={() => centre(a.artist_mbid)} aria-label={`Centre on ${a.name}`}>
                      Centre
                    </Button>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      )}
    </Page>
  );
}

function formatScore(score?: number) {
  if (score == null) return "—";
  return score >= 10 ? fmtInt(score) : score.toFixed(2);
}
