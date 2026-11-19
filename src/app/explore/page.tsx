"use client";

import * as React from "react";
import NextLink from "next/link";
import { Page } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useLB } from "@/lib/use-lb";
import { caaCover, releaseCover } from "@/lib/listen";
import { releasesFromResponse } from "@/components/explore/fresh-releases";
import { CoverArt, cx } from "@/components/ui";

type ExploreTool = {
  key: string;
  name: string;
  description: string;
  href: string;
  /** Only shown for signed-in users. */
  signedInOnly?: boolean;
  thumb?: "fresh" | "collage";
};

const TOOLS: ExploreTool[] = [
  {
    key: "fresh",
    name: "Fresh releases",
    description: "Albums and singles that came out recently, across the site or picked for you.",
    href: "/explore/fresh-releases",
    thumb: "fresh",
  },
  {
    key: "huesound",
    name: "Huesound",
    description: "Pick a colour and find releases whose cover art is close to it.",
    href: "/explore/huesound",
  },
  {
    key: "lb-radio",
    name: "LB Radio",
    description: "Describe the music you want in a short prompt and get a playlist back.",
    href: "/explore/lb-radio",
  },
  {
    key: "music-neighborhood",
    name: "Music neighborhood",
    description: "A graph of artists who sit near the one you pick.",
    href: "/explore/music-neighborhood",
  },
  {
    key: "similar-users",
    name: "Similar users",
    description: "People whose listening overlaps most with yours.",
    href: "/explore/similar-users",
  },
  {
    key: "art-creator",
    name: "Stats art creator",
    description: "Make shareable cover-art grids and designs from your listening stats.",
    href: "/explore/art-creator",
  },
  {
    key: "collage",
    name: "Cover art collage",
    description: "The 2023 and 2022 mosaics of album covers, with the full-size images.",
    href: "/explore/cover-art-collage",
    thumb: "collage",
  },
  {
    key: "yim",
    name: "Year in Music",
    description: "Your yearly breakdown of listening habits.",
    href: "",
    signedInOnly: true,
  },
];

export default function ExplorePage() {
  const { user } = useAuth();
  const visible = TOOLS.filter((t) => !t.signedInOnly || !!user);

  return (
    <Page
      title="Explore"
      subtitle="Tools that turn ListenBrainz data into new music, shared stats and small social experiments."
    >
      <ul className="flex flex-col rounded-[20px] bg-card p-2">
        {visible.map((tool) => {
          const href = tool.key === "yim" && user ? `/user/${encodeURIComponent(user.name)}/year-in-music` : tool.href;
          return (
            <li key={tool.key}>
              <ExploreRow tool={tool} href={href} />
            </li>
          );
        })}
      </ul>
    </Page>
  );
}

function ExploreRow({ tool, href }: { tool: ExploreTool; href: string }) {
  return (
    <NextLink
      href={href}
      className="group flex min-h-[72px] items-center gap-4 rounded-[12px] px-3 py-2.5 transition-colors hover:bg-[#161616]"
    >
      <div className="flex-none">
        {tool.thumb === "fresh" ? <FreshThumb /> : null}
        {tool.thumb === "collage" ? <CollageThumb /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className={cx("text-[15px] font-medium leading-6 group-hover:text-data")}>{tool.name}</div>
        <div className="text-[13px] leading-5 text-ink-2">{tool.description}</div>
      </div>
    </NextLink>
  );
}

/** Four current covers from the last week, as a 2x2 mosaic. Empty tile when the archive has none. */
function FreshThumb() {
  const { data, error, isLoading } = useLB(["explore-thumb-fresh"], (api) =>
    api.fetchSitewideFreshReleases(7, true, false, "release_date")
  );
  const covers = React.useMemo(() => {
    const list = releasesFromResponse(data);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of list) {
      const src = caaCover(r.caa_release_mbid, r.caa_id, 250) ?? releaseCover(r.release_mbid, 250);
      if (!src || seen.has(src)) continue;
      seen.add(src);
      out.push(src);
      if (out.length === 4) break;
    }
    return out;
  }, [data]);

  if (isLoading) return <div className="skel size-14 rounded-[8px]" aria-label="Loading covers" />;
  if (error || covers.length === 0) {
    return <div className="size-14 rounded-[8px] bg-raised" aria-hidden />;
  }
  return (
    <div className="grid size-14 grid-cols-2 gap-px overflow-hidden rounded-[8px] bg-black">
      {[0, 1, 2, 3].map((i) =>
        covers[i] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={covers[i]} src={covers[i]} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <div key={`empty-${i}`} className="bg-raised" />
        )
      )}
    </div>
  );
}

function CollageThumb() {
  return (
    <CoverArt
      src="https://staticbrainz.org/LB/year-in-music/2023/mosaic-2023-small.jpg"
      alt="2023 album mosaic"
      size={56}
      rounded={8}
    />
  );
}
