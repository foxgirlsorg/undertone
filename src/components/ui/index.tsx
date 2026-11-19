"use client";

/*
  Undertone UI kit — small building blocks every screen uses, on top of HeroUI.
  Rules (true-black-flat): panels are #111 on #000 with no border/shadow; nested #2a2a2a;
  colour only on data (var(--data)); primary action = HeroUI <Button> (default variant is the white pill).
*/

import * as React from "react";
import NextLink from "next/link";
import { Button, Spinner, Switch } from "@heroui/react";
import { STATS_RANGES } from "@/lib/format";

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");
export { cx };

/** Screen frame: one h1 (20px/600), an optional grey sentence about the data, actions on the right. */
export function Page({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-[14px]", className)}>
      <header className="flex flex-wrap items-end justify-between gap-3 pb-2 pt-6">
        <div className="min-w-0">
          <h1 className="text-[20px] font-semibold leading-7 tracking-[-0.01em]">{title}</h1>
          {subtitle ? <p className="mt-1 text-[14px] text-ink-2">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}

/** A card section with a 16px heading and an optional right-hand slot (period, "View all"). */
export function Panel({
  title,
  aside,
  children,
  className,
  bodyClassName,
  as: As = "section",
}: {
  title?: React.ReactNode;
  aside?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: "section" | "div";
}) {
  return (
    <As className={cx("rounded-[20px] bg-card p-[22px]", className)}>
      {title || aside ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          {title ? <h2 className="min-w-0 text-[16px] font-medium leading-6">{title}</h2> : <span />}
          {aside ? <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-3">{aside}</div> : null}
        </div>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </As>
  );
}

/** Internal link: white text, no underline, data hue on hover. */
export function Link({
  href,
  children,
  className,
  muted,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  muted?: boolean;
}) {
  return (
    <NextLink
      href={href}
      className={cx(
        "rounded-sm transition-colors hover:text-data max-sm:-my-3 max-sm:py-3",
        muted ? "text-ink-2" : "text-ink",
        className
      )}
    >
      {children}
    </NextLink>
  );
}

/** Square cover art with a quiet fallback tile (initials) when the archive has no image. */
export function CoverArt({
  src,
  alt,
  size = 48,
  className,
  rounded = 4,
}: {
  src?: string;
  alt: string;
  size?: number;
  className?: string;
  rounded?: number;
}) {
  const [failedSrc, setFailedSrc] = React.useState<string>();
  const failed = !!src && failedSrc === src;
  const style = { width: size, height: size, borderRadius: rounded };
  if (!src || failed) {
    const initials = alt
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
    return (
      <div
        aria-label={alt}
        role="img"
        style={style}
        className={cx(
          "flex flex-none items-center justify-center bg-raised text-[12px] font-medium text-ink-3",
          className
        )}
      >
        {initials || "—"}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailedSrc(src)}
      style={style}
      className={cx("flex-none bg-raised object-cover", className)}
    />
  );
}

/**
 * Person avatar: a stable initial on a pale tint derived from the name. Identity, not data.
 * With `src` (only where the profile owner is shown) the image is drawn instead, and the initial returns if it fails.
 */
export function UserAvatar({ name, size = 32, src }: { name: string; size?: number; src?: string }) {
  const [failedSrc, setFailedSrc] = React.useState<string>();
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) % 360;
  if (src && failedSrc !== src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailedSrc(src)}
        style={{ width: size, height: size }}
        className="inline-flex flex-none rounded-full bg-raised object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        fontSize: Math.max(12, Math.round(size * 0.4)),
        background: `hsl(${h} 30% 22%)`,
        color: `hsl(${h} 60% 82%)`,
      }}
      className="inline-flex flex-none items-center justify-center rounded-full font-semibold leading-none"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function UserLink({ name, avatar }: { name: string; avatar?: boolean }) {
  return (
    <NextLink
      href={`/user/${encodeURIComponent(name)}`}
      className="inline-flex items-center gap-2 font-medium hover:text-data max-sm:-my-2.5 max-sm:py-2.5"
    >
      {avatar ? <UserAvatar name={name} size={24} /> : null}
      {name}
    </NextLink>
  );
}

/** A label over a value. Use inside <KpiStrip>. */
export function Kpi({ label, value, note }: { label: string; value: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="min-w-0 px-[22px] py-4 first:pl-0">
      <div className="text-[12px] text-ink-3">{label}</div>
      <div className="num mt-1 text-[24px] font-medium leading-8">{value}</div>
      {note ? <div className="mt-0.5 text-[12px] text-ink-2">{note}</div> : null}
    </div>
  );
}

/** One container split by hairlines into equal columns; 2-up on the phone. */
export function KpiStrip({ children }: { children: React.ReactNode }) {
  const n = React.Children.count(children);
  return (
    <div
      className="grid grid-cols-2 gap-y-2 rounded-[20px] bg-card px-[22px] sm:divide-x sm:divide-[#1f1f1f] sm:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]"
      style={{ ["--n" as string]: n }}
    >
      {children}
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "positive" | "negative" | "warning";
}) {
  return <span className={cx("pill", tone !== "neutral" && `pill-${tone}`)}>{children}</span>;
}

/** Empty section: keeps its frame, one sentence, optional action. Never an illustration. */
export function Empty({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-dashed border-[#2e2e2e] px-4 py-3 text-[14px] text-ink-2">
      <span>{children}</span>
      {action}
    </div>
  );
}

/** Error inside the block that failed, with Retry. */
export function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : String(error ?? "Something went wrong.");
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-[#1a1111] px-4 py-3 text-[14px]">
      <span className="flex items-center gap-2">
        <span aria-hidden className="inline-block size-2 rounded-full bg-negative" />
        <span className="text-ink-2">Couldn&apos;t load this. {msg}</span>
      </span>
      {onRetry ? (
        <Button size="sm" variant="tertiary" onPress={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

/** Loading rows at the real pitch: flat bars, no shimmer. */
export function SkeletonRows({ rows = 5, cover = true, pitch = 64 }: { rows?: number; cover?: boolean; pitch?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3" style={{ height: pitch }}>
          {cover ? <div className="skel size-12 flex-none" /> : null}
          <div className="flex-1">
            <div className="skel h-3.5 w-2/5" />
            <div className="skel mt-2 h-3 w-1/4" />
          </div>
          <div className="skel h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-ink-3">
      <Spinner size="sm" color="current" />
      <span>{label}…</span>
    </div>
  );
}

/** Segmented choice of stats range; scrolls sideways on the phone. */
export function RangeTabs({
  value,
  onChange,
  ranges = STATS_RANGES,
}: {
  value: UserStatsAPIRange;
  onChange: (r: UserStatsAPIRange) => void;
  ranges?: typeof STATS_RANGES;
}) {
  return (
    <div role="radiogroup" aria-label="Period" className="-mx-1 flex gap-1 overflow-x-auto px-1">
      {ranges.map((r) => {
        const on = r.key === value;
        return (
          <button
            key={r.key}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(r.key)}
            className={cx(
              "h-8 flex-none rounded-full px-3 text-[13px] transition-colors",
              on ? "bg-white font-medium text-black" : "bg-transparent text-[#bbb] hover:bg-[#1c1c1c] hover:text-white"
            )}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

/** Underline tabs that are real links (sub-navigation between screens). */
export function NavTabs({ items, active }: { items: Array<{ href: string; label: string; key: string }>; active: string }) {
  return (
    <nav aria-label="Sections" className="-mx-1 flex gap-5 overflow-x-auto border-b border-[#1f1f1f] px-1">
      {items.map((it) => {
        const on = it.key === active;
        return (
          <NextLink
            key={it.key}
            href={it.href}
            aria-current={on ? "page" : undefined}
            className={cx(
              "relative flex-none pb-3 pt-1 text-[14px] transition-colors",
              on ? "font-medium text-white" : "text-[#bbb] hover:text-white"
            )}
          >
            {it.label}
            {on ? <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-white" /> : null}
          </NextLink>
        );
      })}
    </nav>
  );
}

/** "Sign in to …" prompt for screens that need a token. */
export function SignInPrompt({ what }: { what: string }) {
  return (
    <Empty
      action={
        <NextLink href="/login" className="rounded-full bg-white px-4 py-1.5 text-[13px] font-medium text-black">
          Sign in
        </NextLink>
      }
    >
      Sign in with your ListenBrainz token to {what}.
    </Empty>
  );
}

/** A settings-style toggle row: label (+ description) on the left, the switch on the right. */
export function SwitchRow({
  label,
  description,
  isSelected,
  onChange,
  isDisabled,
  className,
}: {
  label: React.ReactNode;
  description?: React.ReactNode;
  isSelected: boolean;
  onChange: (on: boolean) => void;
  isDisabled?: boolean;
  className?: string;
}) {
  return (
    <Switch isSelected={isSelected} onChange={onChange} isDisabled={isDisabled} className={cx("w-full min-w-0", className)}>
      {/* Switch.Content is the clickable SwitchButton: label and control both live inside it. */}
      <Switch.Content className="flex w-full min-w-0 cursor-pointer flex-row items-start justify-between gap-4">
        <span className="min-w-0 text-left">
          <span className="block text-[14px] font-medium leading-5 text-white">{label}</span>
          {description ? <span className="mt-0.5 block text-[13px] leading-5 text-ink-2">{description}</span> : null}
        </span>
        <Switch.Control className="mt-0.5 flex-none">
          <Switch.Thumb />
        </Switch.Control>
      </Switch.Content>
    </Switch>
  );
}
