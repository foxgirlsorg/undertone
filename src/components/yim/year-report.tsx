"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth";
import { Empty, ErrorNote, NavTabs, Panel, SkeletonRows } from "@/components/ui";
import {
  YIM_FIRST_YEAR,
  YIM_LATEST_YEAR,
  YIM_YEARS,
  hasReportContent,
  isYimYear,
  useYearReport,
  yimArtUrl,
  type YimReport,
} from "./data";
import {
  CoverArtPanel,
  ListensCalendar,
  PlaylistPanel,
  Row,
  SimilarUsers,
  TopAlbums,
  TopArtists,
  TopGenres,
  TopTracks,
  WeekdayChart,
  YimKpis,
} from "./sections";

/** Year links for one user. `active` is the year on screen, or null. */
export function YearSwitcher({ username, active }: { username: string; active: number | null }) {
  const enc = encodeURIComponent(username);
  return (
    <NavTabs
      items={YIM_YEARS.map((y) => ({ key: String(y), label: String(y), href: `/user/${enc}/year-in-music/${y}` }))}
      active={active == null ? "" : String(active)}
    />
  );
}

const chunk = <T,>(items: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/** The whole year report for one user: heading, year links, then the sections that have data. */
export function YearReport({
  username,
  year,
  initial,
}: {
  username: string;
  year: number;
  /** A report already loaded for this year (e.g. by the "latest year" probe). */
  initial?: YimReport | null;
}) {
  const { api, user } = useAuth();
  const valid = isYimYear(year);
  const q = useYearReport(username, year, initial);

  const isSelf = !!user && user.name.toLowerCase() === username.toLowerCase();
  const heading = `${isSelf ? "Your" : `${username}'s`} ${year} in music`;

  let body: React.ReactNode;
  if (!valid) {
    body = (
      <Empty>
        Year in Music reports are available for {YIM_FIRST_YEAR} to {YIM_LATEST_YEAR}.
      </Empty>
    );
  } else if (q.error) {
    body = <ErrorNote error={q.error} onRetry={() => q.mutate()} />;
  } else if (q.data === undefined) {
    body = (
      <Panel>
        <SkeletonRows rows={6} />
      </Panel>
    );
  } else if (q.data === null || !hasReportContent(q.data)) {
    body = (
      <Empty>
        There is no Year in Music report for {username} in {year}. Pick another year above.
      </Empty>
    );
  } else {
    body = <Sections report={q.data} username={username} artUrl={yimArtUrl(api, username, year)} />;
  }

  return (
    <div className="flex flex-col gap-[14px]">
      <h2 className="pt-2 text-[20px] font-semibold leading-7">{heading}</h2>
      <YearSwitcher username={username} active={valid ? year : null} />
      {body}
    </div>
  );
}

function Sections({ report: r, username, artUrl }: { report: YimReport; username: string; artUrl: string }) {
  const hasKpis = r.listens != null || r.newArtists != null || r.listeningSeconds != null;
  const playlistRows = chunk(r.playlists, 2);
  return (
    <>
      {hasKpis ? <YimKpis report={r} /> : null}

      {r.days.length > 0 ? <ListensCalendar year={r.year} days={r.days} /> : null}

      <Row spans={[3, 3]}>
        {r.artists.length > 0 ? <TopArtists items={r.artists} /> : null}
        {r.genres.length > 0 ? <TopGenres items={r.genres} /> : null}
      </Row>

      {r.albums.length > 0 ? <TopAlbums items={r.albums} /> : null}

      <Row spans={[4, 2]}>
        {r.tracks.length > 0 ? <TopTracks items={r.tracks} /> : null}
        {r.days.length > 0 ? <WeekdayChart days={r.days} dayOfWeek={r.dayOfWeek} /> : null}
      </Row>

      {playlistRows.map((pair) => (
        <Row key={pair.map((p) => p.key).join("|")} spans={[3, 3]}>
          {pair.map((p) => (
            <PlaylistPanel key={p.key} playlist={p} />
          ))}
        </Row>
      ))}

      <Row spans={[3, 3]}>
        {r.similar.length > 0 ? <SimilarUsers items={r.similar} /> : null}
        <CoverArtPanel src={artUrl} username={username} year={r.year} />
      </Row>
    </>
  );
}
