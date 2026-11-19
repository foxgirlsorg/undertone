"use client";

/*
  Shared parts of the entity pages: the header card (the object itself), link buttons,
  tags, release tiles, KPI blocks and a list of ListenCards with feedback loaded in one request.
*/

import * as React from "react";
import NextLink from "next/link";
import { Button } from "@heroui/react";
import { ListenCard } from "@/components/listen/listen-card";
import { CoverArt, Link, Pill } from "@/components/ui";
import { useListFeedback } from "@/lib/feedback";
import { listenKey } from "@/lib/listen";
import { fmtCompact, fmtDuration, fmtInt } from "@/lib/format";

/** A Button that navigates (internal or external) and looks like a HeroUI button. */
export function ButtonLink({
  href,
  external,
  variant = "secondary",
  children,
  ariaLabel,
}: {
  href: string;
  external?: boolean;
  variant?: "primary" | "secondary" | "tertiary" | "ghost";
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <Button
      variant={variant}
      aria-label={ariaLabel}
      render={(props) => {
        // HeroUI passes its own ref/props for the rendered element; they are forwarded untouched.
        const p = props as unknown as React.AnchorHTMLAttributes<HTMLAnchorElement>;
        return external ? (
          <a {...p} href={href} target="_blank" rel="noopener noreferrer" />
        ) : (
          <NextLink {...(p as React.ComponentProps<typeof NextLink>)} href={href} />
        );
      }}
    >
      {children}
    </Button>
  );
}

/** Entity header card: cover (or tile), h1, credit line, grey meta, tags and actions on the right. */
export function EntityHeader({
  cover,
  title,
  credit,
  meta,
  tags,
  actions,
}: {
  cover: React.ReactNode;
  title: string;
  credit?: React.ReactNode;
  meta?: React.ReactNode[];
  tags?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const parts = (meta ?? []).filter(Boolean);
  return (
    <section className="flex flex-col gap-4 rounded-[20px] bg-card p-[22px] sm:flex-row sm:items-start">
      <div className="flex-none">{cover}</div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h1 className="break-words text-[20px] font-semibold leading-7 tracking-[-0.01em]">{title}</h1>
        {credit ? <div className="text-[14px] text-ink-2">{credit}</div> : null}
        {parts.length ? (
          <div className="text-[13px] text-ink-3">
            {parts.map((p, i) => (
              <React.Fragment key={i}>
                {i > 0 ? <span aria-hidden> · </span> : null}
                {p}
              </React.Fragment>
            ))}
          </div>
        ) : null}
        {tags ? <div className="mt-1 flex flex-wrap gap-1.5">{tags}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 sm:flex-none sm:justify-end">{actions}</div> : null}
    </section>
  );
}

/** Neutral pills for tags; genres first, then tags by count. */
export function TagPills({ tags, max = 12 }: { tags: Array<{ name: string }>; max?: number }) {
  const shown = tags.slice(0, max);
  return (
    <>
      {shown.map((t) => (
        <Pill key={t.name}>{t.name}</Pill>
      ))}
    </>
  );
}

/** A square cover tile with a title and a meta line, linking to an entity page. */
export function ReleaseTile({
  href,
  src,
  alt,
  title,
  meta,
  size = 140,
}: {
  href: string;
  src?: string;
  alt: string;
  title: string;
  meta?: React.ReactNode;
  size?: number;
}) {
  return (
    <div className="flex flex-col gap-2" style={{ width: size }}>
      <NextLink href={href} className="block rounded-[8px] transition-opacity hover:opacity-80" aria-label={title}>
        <CoverArt src={src} alt={alt} size={size} rounded={8} />
      </NextLink>
      <div className="min-w-0">
        <Link href={href} className="block truncate text-[14px] font-medium">
          {title}
        </Link>
        {meta ? <div className="truncate text-[12px] text-ink-3">{meta}</div> : null}
      </div>
    </div>
  );
}

/** A label over a number, used in the top listeners panels. */
export function StatBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[12px] text-ink-3">{label}</div>
      <div className="num mt-0.5 text-[24px] font-medium leading-8">{value}</div>
    </div>
  );
}

/** Rows of ListenCards at the 64px pitch; feedback for the signed-in user comes from one request. */
export function ListenRows({
  listens,
  meta,
  rank,
  compact,
}: {
  listens: Listen[];
  meta?: (l: Listen, i: number) => React.ReactNode;
  rank?: boolean;
  compact?: boolean;
}) {
  const fb = useListFeedback(listens);
  return (
    <div className="flex flex-col">
      {listens.map((l, i) => (
        <ListenCard
          key={listenKey(l, i)}
          listen={l}
          context={listens}
          feedback={fb.get(l)}
          meta={meta ? meta(l, i) : fmtDuration(l.track_metadata?.additional_info?.duration_ms ?? undefined)}
          rank={rank ? i + 1 : undefined}
          compact={compact}
        />
      ))}
    </div>
  );
}

export const playsLabel = (n?: number | null) => `${fmtInt(n ?? 0)} ${n === 1 ? "play" : "plays"}`;
export const compactPlays = (n?: number | null) => `${fmtCompact(n ?? 0)} plays`;

