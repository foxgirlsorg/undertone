"use client";

import * as React from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input, Label, TextField } from "@heroui/react";
import { useAuth } from "@/lib/auth";
import { errorStatus, useLB } from "@/lib/use-lb";
import { caaCover, releaseGroupCover } from "@/lib/listen";
import { fmtInt } from "@/lib/format";
import { CoverArt, ErrorNote, Link, Loading, Page, Panel, SkeletonRows, Empty } from "@/components/ui";

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (user) router.replace("/feed");
  }, [user, router]);

  if (user === undefined || user) return <Loading />;
  return <PublicHome />;
}

function PublicHome() {
  const router = useRouter();
  const [term, setTerm] = React.useState("");

  const artists = useLB(["home-top-artists-week"], (api) =>
    api.getUserEntity(undefined, "artist", "week", 0, 10)
  );
  const fresh = useLB(["home-fresh-releases"], (api) => api.fetchSitewideFreshReleases());

  const artistRows = (artists.data as UserArtistsResponse | undefined)?.payload?.artists ?? [];
  const releases = ((fresh.data as { payload?: { releases?: FreshReleaseItem[] } } | undefined)?.payload?.releases ?? []).slice(0, 10);

  const artistsUnavailable = !!artists.error && [204, 404].includes(errorStatus(artists.error) ?? 0);

  return (
    <Page
      title="Undertone"
      subtitle="A quiet, fast client for your ListenBrainz listens, stats and playlists."
      actions={
        <>
          <Button onPress={() => router.push("/login")}>Sign in</Button>
          <NextLink href="/statistics" className="inline-flex h-9 items-center px-2 text-[14px] text-ink-2 hover:text-white">
            Browse site stats
          </NextLink>
        </>
      }
    >
      <div className="grid gap-[14px] lg:grid-cols-6">
        <Panel
          className="lg:col-span-4"
          title="Top artists this week across ListenBrainz"
          aside={<span>Sitewide</span>}
        >
          {artists.error && !artistsUnavailable ? (
            <ErrorNote error={artists.error} onRetry={() => void artists.mutate()} />
          ) : null}
          {artistsUnavailable ? <Empty>Sitewide stats for this week aren&apos;t calculated yet.</Empty> : null}
          {!artists.data && !artists.error ? <SkeletonRows rows={10} cover={false} pitch={40} /> : null}
          {artists.data && artistRows.length === 0 ? <Empty>No artists listened to this week yet.</Empty> : null}
          {artistRows.length > 0 ? (
            <ol className="flex flex-col">
              {artistRows.map((a, i) => (
                <li key={`${a.artist_name}-${i}`} className="flex h-10 items-center gap-3 text-[14px]">
                  <span className="num w-6 flex-none text-right text-[13px] text-ink-3">{i + 1}</span>
                  <div className="min-w-0 flex-1 truncate">
                    {a.artist_mbid ? (
                      <Link href={`/artist/${a.artist_mbid}`} className="font-medium">
                        {a.artist_name}
                      </Link>
                    ) : (
                      <span className="font-medium">{a.artist_name}</span>
                    )}
                  </div>
                  <span className="num flex-none text-[13px] text-ink-2">{fmtInt(a.listen_count)} listens</span>
                </li>
              ))}
            </ol>
          ) : null}
        </Panel>

        <Panel className="lg:col-span-2" title="Find a user">
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const q = term.trim();
              if (q) router.push(`/search?type=user&q=${encodeURIComponent(q)}`);
            }}
          >
            <p className="text-[14px] text-ink-2">Look up a ListenBrainz username to see their listens and stats.</p>
            <TextField value={term} onChange={setTerm} className="flex flex-col gap-2">
              <Label>Username</Label>
              <Input placeholder="ListenBrainz username" autoComplete="off" className="h-10" />
            </TextField>
            <div>
              <Button type="submit" variant="secondary" isDisabled={!term.trim()}>
                Find user
              </Button>
            </div>
          </form>
        </Panel>
      </div>

      <Panel title="Fresh releases">
        {fresh.error ? <ErrorNote error={fresh.error} onRetry={() => void fresh.mutate()} /> : null}
        {!fresh.data && !fresh.error ? (
          <div className="flex flex-wrap gap-[14px]">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="skel size-[120px]" />
            ))}
          </div>
        ) : null}
        {fresh.data && releases.length === 0 ? <Empty>No fresh releases to show right now.</Empty> : null}
        {releases.length > 0 ? (
          <ul className="flex flex-wrap gap-[14px]">
            {releases.map((r) => (
              <li key={r.release_group_mbid} className="w-[120px]">
                <NextLink href={`/album/${r.release_group_mbid}`} className="group flex flex-col gap-2">
                  <CoverArt
                    src={caaCover(r.caa_release_mbid, r.caa_id, 250) ?? releaseGroupCover(r.release_group_mbid, 250)}
                    alt={r.release_name}
                    size={120}
                    rounded={8}
                  />
                  <span className="truncate text-[13px] font-medium group-hover:text-data">{r.release_name}</span>
                  <span className="truncate text-[12px] text-ink-2">{r.artist_credit_name}</span>
                </NextLink>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>
    </Page>
  );
}

type FreshReleaseItem = {
  artist_credit_name: string;
  caa_id: number | null;
  caa_release_mbid: string | null;
  release_group_mbid: string;
  release_name: string;
};
