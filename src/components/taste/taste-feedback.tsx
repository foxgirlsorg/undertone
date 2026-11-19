"use client";

import * as React from "react";
import { Button } from "@heroui/react";
import { useLB } from "@/lib/use-lb";
import { fmtInt, fmtWhen } from "@/lib/format";
import { ListenCard } from "@/components/listen/listen-card";
import { Empty, ErrorNote, Panel, SkeletonRows, cx } from "@/components/ui";
import { feedbackListen } from "@/components/feed/listen-shapes";

const PER_PAGE = 25;
type Score = 1 | -1;

type FeedbackPage = {
  feedback?: FeedbackResponseWithTrackMetadata[];
  total_count?: number | string;
};

/** Loved / hated tracks of one user, 25 per page. */
export function TasteFeedback({ name }: { name: string }) {
  const [score, setScore] = React.useState<Score>(1);
  const [page, setPage] = React.useState(0);

  const data = useLB(["taste-feedback", name, score, page], (api) =>
    api.getFeedbackForUser(name, page * PER_PAGE, PER_PAGE, score) as Promise<FeedbackPage>
  );

  const rows = (data.data?.feedback ?? []).filter((f) => f.track_metadata);
  const total = Number(data.data?.total_count ?? 0);
  const from = total === 0 ? 0 : page * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE + PER_PAGE, total);
  const hasPrev = page > 0;
  const hasNext = to < total;
  const listens = rows.map(feedbackListen);
  const loading = !data.data && !data.error;
  const noun = score === 1 ? "loved" : "hated";

  const choose = (s: Score) => {
    setScore(s);
    setPage(0);
  };

  return (
    <Panel title="Feedback">
      <div role="radiogroup" aria-label="Feedback type" className="mb-4 flex gap-1">
        {([1, -1] as const).map((s) => {
          const on = score === s;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => choose(s)}
              className={cx(
                "h-8 rounded-full px-3 text-[13px] transition-colors",
                on ? "bg-white font-medium text-black" : "text-[#bbb] hover:bg-[#1c1c1c] hover:text-white"
              )}
            >
              {s === 1 ? "Loved" : "Hated"}
            </button>
          );
        })}
      </div>

      {data.error ? <ErrorNote error={data.error} onRetry={() => void data.mutate()} /> : null}
      {loading ? <SkeletonRows rows={6} /> : null}
      {!loading && !data.error && rows.length === 0 ? <Empty>No {noun} tracks yet.</Empty> : null}

      {rows.length > 0 ? (
        <ul className="flex flex-col" style={{ opacity: data.isValidating ? 0.5 : 1 }}>
          {rows.map((f, i) => (
            <li key={`${f.recording_msid}-${f.created}-${i}`}>
              <ListenCard
                listen={listens[i]}
                feedback={f.score}
                context={listens}
                compact
                meta={fmtWhen(f.created)}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {total > 0 ? (
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="secondary" size="sm" isDisabled={!hasPrev} onPress={() => setPage((p) => Math.max(0, p - 1))}>
            Previous
          </Button>
          <span className="num text-[13px] text-ink-3">
            {fmtInt(from)}–{fmtInt(to)} of {fmtInt(total)}
          </span>
          <Button variant="secondary" size="sm" isDisabled={!hasNext} onPress={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      ) : null}
    </Panel>
  );
}
