"use client";

import * as React from "react";
import useSWR from "swr";
import { Button, Input, Label, Modal, TextField, toast } from "@heroui/react";
import { Empty, ErrorNote, Loading, Page, Pill, SkeletonRows, cx } from "@/components/ui";
import { ListenCard } from "@/components/listen/listen-card";
import { SettingsGate } from "@/components/settings/settings-kit";
import { apiGet, unwrapPayload } from "@/components/settings/api-fetch";
import { escapeLucene, parseLbTimestamp } from "@/components/settings/format";
import { fmtInt } from "@/lib/format";
import { useLB } from "@/lib/use-lb";
import { useApi, type AuthUser } from "@/lib/auth";

export default function LinkListensSettingsPage() {
  return (
    <Page
      title="Link listens"
      subtitle="Listens ListenBrainz cannot match to a MusicBrainz recording yet. Linking one tells it which recording you heard."
    >
      <SettingsGate what="link your listens">{(user) => <LinkArea user={user} />}</SettingsGate>
    </Page>
  );
}

const PAGE_SIZE = 25;
/** The missing-data endpoint returns at most this many rows in total. */
const MAX_ROWS = 1000;

type MissingItem = {
  artist_name: string;
  listened_at: string;
  recording_msid: string;
  release_name?: string | null;
  track_name: string;
};

type MissingPayload = {
  user_name: string;
  last_updated: number;
  count: number;
  total_data_count: number;
  offset: number;
  data: MissingItem[];
};

type MBRecordingHit = {
  id: string;
  title: string;
  "artist-credit"?: Array<{ name: string; joinphrase?: string }>;
  releases?: Array<{ id: string; title: string }>;
};

function toListen(item: MissingItem, userName: string): Listen {
  return {
    listened_at: Math.floor(parseLbTimestamp(item.listened_at).getTime() / 1000),
    user_name: userName,
    track_metadata: {
      artist_name: item.artist_name,
      track_name: item.track_name,
      release_name: item.release_name ?? undefined,
      additional_info: { recording_msid: item.recording_msid },
    },
  } as Listen;
}

function LinkArea({ user }: { user: AuthUser }) {
  const api = useApi();
  const [page, setPage] = React.useState(1);
  const [linked, setLinked] = React.useState<Set<string>>(() => new Set());
  const [target, setTarget] = React.useState<MissingItem | null>(null);

  const offset = (page - 1) * PAGE_SIZE;
  const { data, error, isLoading, mutate } = useLB(["missing-musicbrainz", page], async () => {
    // Public endpoint keyed by username. Its slice is data[offset:count], so count is the end index.
    const body = await apiGet<{ payload: MissingPayload }>(
      `${api.APIBaseURI}/missing/musicbrainz/user/${encodeURIComponent(user.name)}/?offset=${offset}&count=${Math.min(
        offset + PAGE_SIZE,
        MAX_ROWS
      )}`
    );
    return body ? unwrapPayload<MissingPayload>(body) : null;
  });

  const items = (data?.data ?? []).filter((i) => !linked.has(i.recording_msid));
  const total = Math.min(data?.total_data_count ?? 0, MAX_ROWS);
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Group this page's listens by release. Listens with no release are shown on their own.
  const groupMap = new Map<string, MissingItem[]>();
  for (const item of items) {
    const key = item.release_name?.trim() || "";
    groupMap.set(key, [...(groupMap.get(key) ?? []), item]);
  }
  const groups = [...groupMap.entries()].sort((a, b) => b[1].length - a[1].length);

  const onLinked = (msid: string) => {
    setLinked((prev) => new Set(prev).add(msid));
    void mutate();
  };

  return (
    <div>
      {isLoading ? <SkeletonRows rows={6} /> : null}
      {error ? (
        <ErrorNote
          error={error}
          onRetry={() => mutate()}
        />
      ) : null}

      {!isLoading && !error && data === null ? (
        <Empty>
          The list of unmatched listens for {user.name} has not been calculated yet. It is updated periodically.
        </Empty>
      ) : null}

      {data ? (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-[14px] text-ink-2">
            <span>
              {total ? (
                <>
                  <span className="num text-white">{fmtInt(total)}</span> listens without a MusicBrainz match
                  {data.total_data_count > MAX_ROWS ? ` (only the first ${fmtInt(MAX_ROWS)} are listed here)` : ""}.
                </>
              ) : (
                "Every listen has a MusicBrainz match."
              )}
            </span>
          </div>

          {items.length === 0 && total > 0 ? (
            <Empty>Nothing left on this page. Use Older to see more.</Empty>
          ) : null}

          <div className="flex flex-col gap-4">
            {groups.map(([release, rows]) => (
              <section key={release || "__none"} aria-label={release || "No release"}>
                <div className="mb-2 flex items-center gap-2">
                  <h2 className="min-w-0 truncate text-[14px] font-medium">{release || "No release"}</h2>
                  <Pill>{fmtInt(rows.length)}</Pill>
                </div>
                <div className="flex flex-col">
                  {rows.map((item) => (
                    <div key={`${item.recording_msid}-${item.listened_at}`} className="border-t border-[#1a1a1a] first:border-t-0">
                      <ListenCard
                        listen={toListen(item, user.name)}
                        context={rows.map((r) => toListen(r, user.name))}
                        canDelete={false}
                        aside={
                          <Button size="sm" variant="secondary" onPress={() => setTarget(item)}>
                            Link
                          </Button>
                        }
                      />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {total > 0 ? (
            <nav aria-label="Pages" className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-2">
              <span className="num">
                {fmtInt(offset + 1)}–{fmtInt(Math.min(offset + PAGE_SIZE, total))} of {fmtInt(total)}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  isDisabled={page <= 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Newer
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  isDisabled={page >= lastPage}
                  onPress={() => setPage((p) => Math.min(lastPage, p + 1))}
                >
                  Older
                </Button>
              </div>
            </nav>
          ) : null}
        </>
      ) : null}

      {target ? (
        <LinkDialog
          key={`${target.recording_msid}-${target.listened_at}`}
          item={target}
          user={user}
          onClose={() => setTarget(null)}
          onLinked={() => {
            onLinked(target.recording_msid);
            setTarget(null);
          }}
        />
      ) : null}
    </div>
  );
}

function LinkDialog({
  item,
  user,
  onClose,
  onLinked,
}: {
  item: MissingItem;
  user: AuthUser;
  onClose: () => void;
  onLinked: () => void;
}) {
  const api = useApi();
  const defaultQuery = `${escapeLucene(item.track_name)} ${escapeLucene(item.artist_name)}`.trim();
  const [draft, setDraft] = React.useState(defaultQuery);
  const [query, setQuery] = React.useState(defaultQuery);
  const [linking, setLinking] = React.useState<string | null>(null);
  const [linkError, setLinkError] = React.useState<string>();

  const search = useSWR(
    query ? ["mb-recording-search", query] : null,
    async () => {
      const res = await api.recordingLookup(query, 0, 10);
      return (res.recordings ?? []) as MBRecordingHit[];
    },
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  const link = async (hit: MBRecordingHit) => {
    setLinking(hit.id);
    setLinkError(undefined);
    try {
      await api.submitMBIDMapping(user.token, item.recording_msid, hit.id);
      toast.success("Listen linked", { description: `${item.track_name} is now matched to ${hit.title}.` });
      onLinked();
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "The link could not be saved.");
    } finally {
      setLinking(null);
    }
  };

  return (
    <Modal.Backdrop isOpen onOpenChange={(open: boolean) => !open && onClose()}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[560px]">
          <Modal.Header>
            <Modal.Heading>Link “{item.track_name}”</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <p className="mb-3 text-[14px] text-ink-2">
              {item.artist_name}
              {item.release_name ? ` · ${item.release_name}` : ""}. Pick the MusicBrainz recording you heard. Every listen
              of this recording is linked.
            </p>
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setQuery(draft.trim());
              }}
            >
              <TextField value={draft} onChange={setDraft} className="min-w-0 flex-1 flex-col gap-1.5">
                <Label>Search MusicBrainz</Label>
                <Input className="h-10" />
              </TextField>
              <Button type="submit" variant="secondary" isDisabled={!draft.trim()}>
                Search
              </Button>
            </form>

            {linkError ? (
              <p role="alert" className="mt-3 text-[14px] text-negative">
                {linkError}
              </p>
            ) : null}

            <div className="mt-4">
              {search.isLoading ? <Loading label="Searching MusicBrainz" /> : null}
              {search.error ? <ErrorNote error={search.error} onRetry={() => search.mutate()} /> : null}
              {search.data && search.data.length === 0 ? (
                <Empty>No recordings matched “{query}”. Try a shorter search.</Empty>
              ) : null}
              {search.data && search.data.length > 0 ? (
                <ul className="flex max-h-[360px] flex-col gap-1 overflow-y-auto">
                  {search.data.map((hit) => {
                    const artists = (hit["artist-credit"] ?? []).map((a) => `${a.name}${a.joinphrase ?? ""}`).join("");
                    const release = hit.releases?.[0]?.title;
                    return (
                      <li
                        key={hit.id}
                        className={cx("flex items-center justify-between gap-3 rounded-[10px] px-3 py-2", "hover:bg-raised")}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[14px] font-medium">{hit.title}</div>
                          <div className="truncate text-[13px] text-ink-2">
                            {artists}
                            {release ? ` · ${release}` : ""}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          isPending={linking === hit.id}
                          isDisabled={linking !== null}
                          onPress={() => link(hit)}
                        >
                          Link
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="secondary">
              Close
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
