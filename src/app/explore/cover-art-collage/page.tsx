"use client";

import * as React from "react";
import { Button } from "@heroui/react";
import { Page, Panel } from "@/components/ui";
import { Segmented } from "@/components/explore/segmented";
import { LB_WEB_URL } from "@/lib/config";

type Year = "2023" | "2022";

/** Image files published on the ListenBrainz static host (same files the reference page uses). */
const COLLAGES: Record<
  Year,
  { title: string; small: string; medium: string; large?: string; background: string; interactive: string }
> = {
  "2023": {
    title: "Album covers of 2023",
    small: "https://staticbrainz.org/LB/year-in-music/2023/mosaic-2023-small.jpg",
    medium: "https://staticbrainz.org/LB/year-in-music/2023/mosaic-2023-medium.jpg",
    large: "https://staticbrainz.org/LB/year-in-music/2023/mosaic-2023.jpg",
    background: "#F0EEE2",
    interactive: `${LB_WEB_URL}/explore/cover-art-collage/2023/`,
  },
  "2022": {
    title: "Album covers of 2022",
    small: "https://staticbrainz.org/LB/year-in-music/2022/rainbow1-100-7-small.jpeg",
    medium: "https://staticbrainz.org/LB/year-in-music/2022/rainbow1-100-7-medium.jpeg",
    background: "#ff0e25",
    interactive: `${LB_WEB_URL}/explore/cover-art-collage/2022/`,
  },
};

export default function CoverArtCollagePage() {
  const [year, setYear] = React.useState<Year>("2023");
  // "Full size loaded" and "image shown" are remembered per year, so switching years needs no reset effect.
  const [fullFor, setFullFor] = React.useState<Year | null>(null);
  const [loadedFor, setLoadedFor] = React.useState<string | null>(null);
  const full = fullFor === year;
  const collage = COLLAGES[year];
  const src = full && collage.large ? collage.large : collage.medium;
  const loaded = loadedFor === src;

  return (
    <Page
      title="Cover art collage"
      subtitle="Every album cover from a year of listening, packed into one picture. Scroll to explore it."
    >
      <div className="flex flex-col gap-[14px]">
        <Segmented<Year>
          label="Year"
          value={year}
          onChange={setYear}
          options={[
            { value: "2023", label: "2023" },
            { value: "2022", label: "2022" },
          ]}
        />

        <Panel title={collage.title} aside={<a className="hover:text-data" href={collage.interactive} target="_blank" rel="noopener noreferrer">Clickable version on ListenBrainz</a>}>
          {!full && collage.large ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-[#1c1c1c] px-4 py-3 text-[14px] text-ink-2">
              <span>The full-size image is large. Load it only when you want the detail.</span>
              <Button size="sm" variant="secondary" onPress={() => setFullFor(year)}>
                Load full-size image
              </Button>
            </div>
          ) : null}

          <div className="max-h-[80vh] overflow-auto rounded-[12px]" style={{ background: collage.background }}>
            {!loaded ? (
              <div className="skel aspect-[2/1] w-full" aria-label="Loading collage" />
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={src}
              src={src}
              srcSet={full && collage.large ? undefined : `${collage.small} 500w, ${collage.medium} 1000w`}
              sizes="(max-width: 1152px) 100vw, 1152px"
              alt={`Album covers of ${year}, a mosaic of the year's most listened-to releases`}
              onLoad={() => setLoadedFor(src)}
              className={loaded ? "block h-auto w-full" : "hidden"}
            />
          </div>
        </Panel>

        <Panel title="Credits">
          <ul className="flex flex-col gap-2 text-[14px] text-ink-2">
            <li>Each cover belongs to its artist and label. The mosaic only arranges them.</li>
            <li>
              Published by ListenBrainz as part of its {year} Year in Music. The clickable version on ListenBrainz
              links each tile to its release.
            </li>
          </ul>
        </Panel>
      </div>
    </Page>
  );
}
