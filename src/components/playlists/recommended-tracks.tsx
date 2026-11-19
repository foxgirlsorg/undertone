"use client";

import * as React from "react";
import { Button, Dropdown, Label, toast } from "@heroui/react";
import { useAuth } from "@/lib/auth";
import type APIService from "@/lib/api";
import { useLB, errorMessage } from "@/lib/use-lb";
import { useListFeedback } from "@/lib/feedback";
import { ListenCard } from "@/components/listen/listen-card";
import { Empty, ErrorNote, Link, Page, SkeletonRows } from "@/components/ui";
import { Pager } from "./pager";

const PAGE_SIZE = 25;
const METADATA_CHUNK = 50;

const FEEDBACK_OPTIONS: Array<{ id: RecommendationFeedBack; label: string }> = [
  { id: "love", label: "Love" },
  { id: "like", label: "Like" },
  { id: "dislike", label: "Dislike" },
  { id: "hate", label: "Hate" },
];

type CFRecommendation = { recording_mbid: string; score: number };

/** Fetch the metadata for recordings, in requests of 50 MBIDs. */
async function fetchRecordingMetadata(api: APIService, mbids: string[]): Promise<Record<string, ListenMetadata>> {
  const out: Record<string, ListenMetadata> = {};
  for (let i = 0; i < mbids.length; i += METADATA_CHUNK) {
    const url = new URL(`${api.APIBaseURI}/metadata/recording/`);
    url.searchParams.set("recording_mbids", mbids.slice(i, i + METADATA_CHUNK).join(","));
    url.searchParams.set("inc", "artist release");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Metadata request failed (${res.status}).`);
    Object.assign(out, (await res.json()) as Record<string, ListenMetadata>);
  }
  return out;
}

/** A Listen for a recording MBID, from its metadata. Missing metadata yields an honest "Unknown track". */
function recordingToListen(mbid: string, m?: ListenMetadata): Listen {
  const artists = m?.artist?.artists ?? [];
  const artistMBIDs = artists.map((a) => a.artist_mbid);
  return {
    listened_at: 0,
    track_metadata: {
      track_name: m?.recording?.name ?? "Unknown track",
      artist_name: m?.artist?.name ?? (artists.map((a) => a.name).join(", ") || "Unknown artist"),
      release_name: m?.release?.name,
      additional_info: {
        recording_mbid: mbid,
        duration_ms: m?.recording?.length,
        release_mbid: m?.release?.mbid,
        release_group_mbid: m?.release?.release_group_mbid,
        artist_mbids: artistMBIDs,
      },
      mbid_mapping: {
        recording_mbid: mbid,
        release_mbid: m?.release?.mbid ?? "",
        release_group_mbid: m?.release?.release_group_mbid,
        artist_mbids: artistMBIDs,
        artists: artists.map((a) => ({ artist_mbid: a.artist_mbid, artist_credit_name: a.name, join_phrase: a.join_phrase ?? "" })),
        caa_id: m?.release?.caa_id,
        caa_release_mbid: m?.release?.caa_release_mbid,
      },
    },
  };
}

/** The collaborative-filtering recommendations for a user, with recommendation feedback. */
export function RawRecommendedTracks({ username }: { username: string }) {
  const { api, user } = useAuth();
  const isSelf = !!user && user.name === username;
  const [page, setPage] = React.useState(0);
  const [overrides, setOverrides] = React.useState<Record<string, RecommendationFeedBack | null>>({});

  const cf = useLB(["cf-recommendations", username], async (a) => {
    const res = await fetch(
      `${a.APIBaseURI}/cf/recommendation/user/${encodeURIComponent(username)}/recording?count=100`
    );
    if (res.status === 204) return [] as CFRecommendation[];
    if (!res.ok) throw new Error(`ListenBrainz answered ${res.status}.`);
    const body = (await res.json()) as { payload?: { mbids?: CFRecommendation[]; last_updated?: number } };
    return body.payload?.mbids ?? [];
  });
  const recs = cf.data ?? [];
  const mbids = recs.map((r) => r.recording_mbid);
  const mbidsKey = mbids.join(",");

  const meta = useLB(mbids.length ? ["cf-metadata", mbidsKey] : null, (a) => fetchRecordingMetadata(a, mbids));

  const feedback = useLB(isSelf && mbids.length ? ["cf-feedback", username, mbidsKey] : null, async (a) => {
    const res = (await a.getFeedbackForUserForRecommendations(username, mbidsKey)) as {
      feedback?: RecommendationFeedbackResponse[];
    };
    return res?.feedback ?? [];
  });
  const serverRatings = React.useMemo(() => {
    const m = new Map<string, RecommendationFeedBack>();
    (feedback.data ?? []).forEach((f) => m.set(f.recording_mbid, f.rating));
    return m;
  }, [feedback.data]);
  const ratingFor = (mbid: string): RecommendationFeedBack | null =>
    mbid in overrides ? overrides[mbid] : serverRatings.get(mbid) ?? null;

  const allListens = React.useMemo(
    () => mbids.map((mbid) => recordingToListen(mbid, meta.data?.[mbid])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mbidsKey, meta.data]
  );
  const pageListens = allListens.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const love = useListFeedback(pageListens);

  const setRating = async (mbid: string, next: RecommendationFeedBack | null) => {
    if (!user) return;
    const prev = ratingFor(mbid);
    setOverrides((o) => ({ ...o, [mbid]: next }));
    try {
      if (next === null) await api.deleteRecommendationFeedback(user.token, mbid);
      else await api.submitRecommendationFeedback(user.token, mbid, next);
    } catch (e) {
      setOverrides((o) => ({ ...o, [mbid]: prev }));
      toast.danger("Couldn't save recommendation feedback", { description: errorMessage(e) });
    }
  };

  const loading = cf.isLoading || (mbids.length > 0 && meta.isLoading);
  const failure = cf.error ?? meta.error;

  return (
    <Page
      title="Recommended tracks"
      subtitle={`Collaborative-filtering recommendations for ${username}`}
      actions={
        <Link href={`/user/${encodeURIComponent(username)}/recommendations`} muted className="text-[14px]">
          Made for {username}
        </Link>
      }
    >
      {failure ? (
        <ErrorNote error={failure} onRetry={() => (cf.error ? cf.mutate() : meta.mutate())} />
      ) : loading ? (
        <section className="rounded-[20px] bg-card px-[22px] py-2">
          <SkeletonRows rows={6} pitch={64} />
        </section>
      ) : mbids.length === 0 ? (
        <Empty>No recommendations yet. They appear once there is enough recent listening history.</Empty>
      ) : (
        <section className="rounded-[20px] bg-card px-[22px] py-2" aria-label="Recommended tracks">
          <ol className="flex flex-col">
            {pageListens.map((listen, i) => {
              const mbid = mbids[page * PAGE_SIZE + i];
              const rating = ratingFor(mbid);
              return (
                <li key={`${mbid}-${page * PAGE_SIZE + i}`}>
                  <ListenCard
                    listen={listen}
                    context={allListens}
                    feedback={love.get(listen)}
                    canDelete={false}
                    rank={page * PAGE_SIZE + i + 1}
                    aside={
                      isSelf && user ? (
                        <RecommendationFeedbackControl value={rating} onChange={(next) => setRating(mbid, next)} />
                      ) : undefined
                    }
                  />
                </li>
              );
            })}
          </ol>
          <Pager page={page} pageSize={PAGE_SIZE} total={allListens.length} onPage={setPage} />
        </section>
      )}
      {isSelf && mbids.length ? (
        <p className="text-[12px] text-ink-3">Your feedback tunes future recommendations.</p>
      ) : null}
    </Page>
  );
}

/** Like / Dislike / Love / Hate for a recommendation. Choosing the current value again clears it. */
export function RecommendationFeedbackControl({
  value,
  onChange,
}: {
  value: RecommendationFeedBack | null;
  onChange: (next: RecommendationFeedBack | null) => void;
}) {
  const current = FEEDBACK_OPTIONS.find((o) => o.id === value);
  return (
    <Dropdown>
      <Button size="sm" variant={value ? "secondary" : "ghost"} aria-label={current ? `Feedback: ${current.label}` : "Rate this recommendation"} className="text-ink-2">
        {current ? current.label : "Rate"}
      </Button>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu
          onAction={(key) => {
            const k = String(key);
            if (k === "clear") return onChange(null);
            const next = k as RecommendationFeedBack;
            onChange(next === value ? null : next);
          }}
        >
          {FEEDBACK_OPTIONS.map((o) => (
            <Dropdown.Item key={o.id} id={o.id} textValue={o.label}>
              <Label>{o.label}</Label>
            </Dropdown.Item>
          ))}
          {value ? (
            <Dropdown.Item id="clear" textValue="Remove rating">
              <Label>Remove rating</Label>
            </Dropdown.Item>
          ) : null}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
