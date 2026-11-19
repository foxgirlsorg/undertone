"use client";

import * as React from "react";
import { Button } from "@heroui/react";
import { Empty, ErrorNote, Page, Panel, Pill, SkeletonRows, UserLink, cx } from "@/components/ui";
import { OutButton } from "@/components/settings/settings-kit";
import { apiGet } from "@/components/settings/api-fetch";
import { fmtMoney } from "@/components/settings/format";
import { fmtDateLong, fmtInt } from "@/lib/format";
import { useLB } from "@/lib/use-lb";
import { LB_WEB_URL } from "@/lib/config";

type Donor = {
  id?: number;
  donated_at: string;
  donation: number;
  currency: string;
  musicbrainz_id: string | null;
  is_listenbrainz_user: boolean;
  flair?: string | null;
};

const PAGE_SIZE = 25;
const MODES: Array<{ key: "recent" | "biggest"; label: string }> = [
  { key: "recent", label: "Most recent" },
  { key: "biggest", label: "Biggest" },
];

const FLAIR_NAMES: Record<string, string> = {
  shake: "Shake",
  "lb-colors-sweep": "Colour sweep",
  "light-sweep": "Light sweep",
  wave: "Wave",
  "flip-horizontal": "Flip horizontal",
  "flip-vertical": "Flip vertical",
  "flip-3d": "Flip 3D",
  extruded: "Extruded",
  underline: "Underline",
  tornado: "Tornado",
  highlighter: "Highlighter",
  anaglyph: "Anaglyph",
  sliced: "Sliced",
};

export default function DonorsPage() {
  const [mode, setMode] = React.useState<"recent" | "biggest">("recent");
  const [page, setPage] = React.useState(1);

  const donors = useLB(["donors", mode, page], (api) =>
    apiGet<Donor[]>(`${api.APIBaseURI}/donors/${mode}?count=${PAGE_SIZE}&offset=${(page - 1) * PAGE_SIZE}`).then(
      (rows) => rows ?? []
    )
  );

  const rows = donors.data ?? [];
  const hasNext = rows.length === PAGE_SIZE;
  const first = (page - 1) * PAGE_SIZE + 1;

  return (
    <Page
      title="Donors"
      subtitle="Donations keep ListenBrainz running. Donors can unlock flairs, a small name effect shown next to their username."
      actions={<OutButton href={`${LB_WEB_URL}/donate/`} primary>Donate</OutButton>}
    >
      <Panel
        title="Donations"
        aside={
          <div role="radiogroup" aria-label="Sort donations" className="flex gap-1">
            {MODES.map((m) => {
              const on = m.key === mode;
              return (
                <button
                  key={m.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setMode(m.key);
                    setPage(1);
                  }}
                  className={cx(
                    "h-8 rounded-full px-3 text-[13px] transition-colors",
                    on ? "bg-white font-medium text-black" : "text-[#bbb] hover:bg-[#1c1c1c] hover:text-white"
                  )}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        }
      >
        {donors.isLoading ? <SkeletonRows rows={6} cover={false} pitch={56} /> : null}
        {donors.error ? <ErrorNote error={donors.error} onRetry={() => donors.mutate()} /> : null}
        {donors.data && rows.length === 0 ? <Empty>No donations to show{page > 1 ? " on this page" : " yet"}.</Empty> : null}

        {rows.length ? (
          <ul className="flex flex-col divide-y divide-[#1f1f1f]">
            {rows.map((d, i) => (
              <li key={`${d.musicbrainz_id ?? "anon"}-${d.donated_at}-${i}`} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <DonorName donor={d} />
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
                    <span>{fmtDateLong(d.donated_at)}</span>
                    {d.flair ? <Pill>{FLAIR_NAMES[d.flair] ?? d.flair}</Pill> : null}
                  </div>
                </div>
                <span className="num flex-none text-right text-[16px] font-medium">
                  {fmtMoney(d.donation, d.currency)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {donors.data ? (
          <nav aria-label="Pages" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-2">
            <span className="num">
              {rows.length ? `${fmtInt(first)}–${fmtInt(first + rows.length - 1)}` : "No results"}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" isDisabled={page <= 1} onPress={() => setPage((p) => Math.max(1, p - 1))}>
                Newer
              </Button>
              <Button size="sm" variant="secondary" isDisabled={!hasNext} onPress={() => setPage((p) => p + 1)}>
                Older
              </Button>
            </div>
          </nav>
        ) : null}
      </Panel>
    </Page>
  );
}

function DonorName({ donor }: { donor: Donor }) {
  const name = donor.musicbrainz_id;
  if (!name) return <span className="text-[14px] text-ink-3">Anonymous donor</span>;
  if (donor.is_listenbrainz_user) {
    return (
      <span className="text-[14px] font-medium">
        <UserLink name={name} />
      </span>
    );
  }
  return (
    <a
      href={`https://musicbrainz.org/user/${encodeURIComponent(name)}`}
      target="_blank"
      rel="noreferrer"
      className="text-[14px] font-medium hover:text-data"
    >
      {name}
    </a>
  );
}
