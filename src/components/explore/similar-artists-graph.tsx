"use client";

import * as React from "react";

export type GraphArtist = { artist_mbid: string; name: string; score?: number };

const VIEW = 600;
const CENTER = VIEW / 2;
const RING = 205;
const SEED_R = 46;
const MIN_NODE_R = 16;
const MAX_NODE_R = 36;

/**
 * Radial graph: the seed in the middle, similar artists on a ring. Node radius follows the score.
 * Clicking a node calls onCentre with its MBID so the caller can re-centre the graph on it.
 */
export function SimilarArtistsGraph({
  seed,
  artists,
  onCentre,
}: {
  seed: { artist_mbid: string; name: string };
  artists: GraphArtist[];
  onCentre: (mbid: string) => void;
}) {
  const maxScore = Math.max(0, ...artists.map((a) => a.score ?? 0));
  const minScore = Math.min(...artists.map((a) => a.score ?? 0));
  const span = maxScore - minScore;

  const nodes = artists.map((a, i) => {
    const angle = (i / Math.max(artists.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const t = span > 0 ? ((a.score ?? 0) - minScore) / span : 1;
    const r = MIN_NODE_R + (MAX_NODE_R - MIN_NODE_R) * t;
    const x = CENTER + Math.cos(angle) * RING;
    const y = CENTER + Math.sin(angle) * RING;
    const labelOnRight = Math.cos(angle) >= 0;
    return { ...a, x, y, r, labelOnRight, angle };
  });

  return (
    <svg
      role="img"
      aria-label={`Artists similar to ${seed.name}`}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      className="aspect-square w-full max-w-[600px]"
    >
      {nodes.map((n) => (
        <line
          key={`edge-${n.artist_mbid}`}
          x1={CENTER}
          y1={CENTER}
          x2={n.x}
          y2={n.y}
          stroke="#2b2b2b"
          strokeWidth={2}
        />
      ))}

      {nodes.map((n) => {
        const lx = n.x + Math.cos(n.angle) * (n.r + 8);
        const ly = n.y + Math.sin(n.angle) * (n.r + 8);
        return (
          <g
            key={n.artist_mbid}
            role="button"
            tabIndex={0}
            aria-label={`Centre the graph on ${n.name}`}
            className="cursor-pointer outline-none"
            onClick={() => onCentre(n.artist_mbid)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onCentre(n.artist_mbid);
              }
            }}
          >
            <title>{n.name}</title>
            <circle cx={n.x} cy={n.y} r={n.r} fill="#2a2a2a" className="transition-colors hover:fill-[#3a3a3a]" />
            <text
              x={lx}
              y={ly}
              fill="#b4b4b4"
              fontSize={13}
              dominantBaseline="middle"
              textAnchor={n.labelOnRight ? "start" : "end"}
            >
              {n.name.length > 22 ? `${n.name.slice(0, 21)}…` : n.name}
            </text>
          </g>
        );
      })}

      <circle cx={CENTER} cy={CENTER} r={SEED_R} style={{ fill: "var(--data)" }}>
        <title>{seed.name}</title>
      </circle>
      <text
        x={CENTER}
        y={CENTER + SEED_R + 22}
        fill="#ffffff"
        fontSize={15}
        fontWeight={500}
        textAnchor="middle"
      >
        {seed.name.length > 26 ? `${seed.name.slice(0, 25)}…` : seed.name}
      </text>
    </svg>
  );
}
