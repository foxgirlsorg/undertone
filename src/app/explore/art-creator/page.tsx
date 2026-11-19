"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input, Label, TextField, toast } from "@heroui/react";
import { ArrowDownToLine, Copy } from "@gravity-ui/icons";
import { Page, Panel, Empty, ErrorNote, Loading } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { ToggleChip, Segmented } from "@/components/explore/segmented";
import {
  ART_DESIGNS,
  ART_GRID_LAYOUTS,
  ART_RANGES,
  ART_SIZES,
  DEFAULT_ART_RANGE,
  DEFAULT_GRID_OPTIONS,
  artUrl,
  isArtDesign,
  isArtRange,
  type ArtDesign,
  type ArtGridOptions,
  type ArtRange,
  type ArtSize,
} from "@/components/explore/art";

export default function ArtCreatorPage() {
  return (
    <Suspense fallback={null}>
      <ArtCreator />
    </Suspense>
  );
}

type Style = "grid" | ArtDesign;
type Preview =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error"; error: Error }
  | { status: "ready"; blob: Blob; objectUrl: string };

const selectClass =
  "h-9 rounded-full bg-[#1c1c1c] px-3 text-[13px] text-white outline-none focus-visible:ring-2 focus-visible:ring-white";

function ArtCreator() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { api, user: me } = useAuth();

  const urlUser = searchParams.get("user")?.trim() || null;
  const subject = urlUser ?? me?.name ?? null;
  const range: ArtRange = isArtRange(searchParams.get("range")) ? (searchParams.get("range") as ArtRange) : DEFAULT_ART_RANGE;
  const style: Style = searchParams.get("style") === "grid" ? "grid" : isArtDesign(searchParams.get("style")) ? (searchParams.get("style") as ArtDesign) : "grid";
  const sizeParam = Number(searchParams.get("size"));
  const size: ArtSize = (ART_SIZES as readonly number[]).includes(sizeParam) ? (sizeParam as ArtSize) : 750;

  const dimParam = Number(searchParams.get("dim"));
  const dimension = dimParam >= 1 && dimParam <= 5 ? dimParam : 4;
  const layouts = ART_GRID_LAYOUTS[dimension] ?? [0];
  const layoutParam = Number(searchParams.get("layout"));
  const layout = layouts.includes(layoutParam) ? layoutParam : layouts[0];

  // What the user has typed; null means "not edited, show the account or URL user".
  const [edited, setEdited] = React.useState<string | null>(null);
  const typedUser = edited ?? urlUser ?? me?.name ?? "";
  const setTypedUser = (v: string) => setEdited(v);

  const [grid, setGrid] = React.useState<ArtGridOptions>(DEFAULT_GRID_OPTIONS);

  const setParams = (patch: Record<string, string>) => {
    const q = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) q.set(k, v);
    router.replace(`/explore/art-creator?${q.toString()}`, { scroll: false });
  };

  const url = subject
    ? artUrl({ apiBase: api.APIBaseURI, user: subject, range, size, design: style, dimension, layout, grid })
    : null;

  // The result is stored with the request it belongs to, so a changed choice shows "loading" at once
  // without an effect having to reset state.
  const [attempt, setAttempt] = React.useState(0);
  const requestKey = url ? `${url}#${attempt}` : null;
  const [settled, setSettled] = React.useState<{ key: string; result: Preview } | null>(null);
  const preview: Preview = settled && settled.key === requestKey ? settled.result : { status: "loading" };

  React.useEffect(() => {
    if (!url || !requestKey) return;
    const ctrl = new AbortController();
    let objectUrl: string | null = null;
    const done = (result: Preview) => setSettled({ key: requestKey, result });
    fetch(url, { signal: ctrl.signal })
      .then(async (res) => {
        if (res.status === 204 || res.status === 404) {
          done({ status: "empty" });
          return;
        }
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
          throw new Error(body?.error ?? body?.message ?? `The art service returned ${res.status}.`);
        }
        const blob = await res.blob();
        if (!blob.type.includes("svg") && blob.type !== "") {
          throw new Error("The art service did not return an image for this choice.");
        }
        objectUrl = URL.createObjectURL(blob);
        done({ status: "ready", blob, objectUrl });
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        done({ status: "error", error: e instanceof Error ? e : new Error(String(e)) });
      });
    return () => {
      ctrl.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, requestKey]);

  const rangeLabel = ART_RANGES.find((r) => r.value === range)?.label ?? range;
  const styleLabel = style === "grid" ? "Album grid" : ART_DESIGNS.find((d) => d.value === style)?.label ?? style;

  const download = () => {
    if (preview.status !== "ready" || !subject) return;
    const a = document.createElement("a");
    a.href = preview.objectUrl;
    a.download = `${subject}-${style}-${range}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const copyLink = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Image link copied");
    } catch (e) {
      toast.danger("Couldn't copy the link", { description: (e as Error).message });
    }
  };

  const toggleGrid = (k: keyof ArtGridOptions) => setGrid((g) => ({ ...g, [k]: !g[k] }));

  return (
    <Page
      title="Stats art creator"
      subtitle="Make a shareable cover-art image from a listener's stats. Pick a style, then download the SVG or copy its link."
    >
      <div className="grid gap-[14px] lg:grid-cols-6">
        <Panel className="flex flex-col gap-5 lg:col-span-2" title="Options">
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const name = typedUser.trim();
              if (!name) return;
              setEdited(null);
              router.replace(`/explore/art-creator?${withParam(searchParams, "user", name)}`, { scroll: false });
            }}
          >
            <TextField value={typedUser} onChange={setTypedUser} name="user" className="w-full">
              <Label>User</Label>
              <Input autoComplete="off" spellCheck={false} placeholder="username" />
            </TextField>
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" variant="secondary" isDisabled={!typedUser.trim()}>
                Use this user
              </Button>
              {me && subject !== me.name ? (
                <Button
                  size="sm"
                  variant="tertiary"
                  onPress={() => {
                    setEdited(null);
                    router.replace(`/explore/art-creator?${withParam(searchParams, "user", me.name)}`, { scroll: false });
                  }}
                >
                  Use my account
                </Button>
              ) : null}
            </div>
          </form>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] text-ink-3">Style</span>
            <Segmented<Style>
              label="Style"
              value={style}
              onChange={(v) => setParams({ style: v })}
              options={[{ value: "grid", label: "Album grid" }, ...ART_DESIGNS.map((d) => ({ value: d.value, label: d.label }))]}
              className="flex-wrap overflow-visible"
            />
          </div>

          <label className="flex flex-col gap-2 text-[13px] text-ink-3">
            Time range
            <select className={selectClass} value={range} onChange={(e) => setParams({ range: e.target.value })}>
              {ART_RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          {style === "grid" ? (
            <>
              <div className="flex flex-wrap gap-3">
                <label className="flex flex-col gap-2 text-[13px] text-ink-3">
                  Grid size
                  <select
                    className={selectClass}
                    value={dimension}
                    onChange={(e) => setParams({ dim: e.target.value, layout: "0" })}
                  >
                    {[1, 2, 3, 4, 5].map((d) => (
                      <option key={d} value={d}>
                        {d} × {d}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-[13px] text-ink-3">
                  Layout
                  <select
                    className={selectClass}
                    value={layout}
                    onChange={(e) => setParams({ layout: e.target.value })}
                  >
                    {layouts.map((l) => (
                      <option key={l} value={l}>
                        Layout {l + 1}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[13px] text-ink-3">Captions</span>
                <div className="flex flex-wrap gap-2">
                  <ToggleChip pressed={grid.caption} onPressedChange={() => toggleGrid("caption")}>
                    Captions
                  </ToggleChip>
                  <ToggleChip pressed={grid.showArtist} onPressedChange={() => toggleGrid("showArtist")}>
                    Artist
                  </ToggleChip>
                  <ToggleChip pressed={grid.showRelease} onPressedChange={() => toggleGrid("showRelease")}>
                    Release
                  </ToggleChip>
                  <ToggleChip pressed={grid.showRank} onPressedChange={() => toggleGrid("showRank")}>
                    Rank
                  </ToggleChip>
                  <ToggleChip pressed={grid.showListenCount} onPressedChange={() => toggleGrid("showListenCount")}>
                    Listen count
                  </ToggleChip>
                  <ToggleChip pressed={grid.skipMissing} onPressedChange={() => toggleGrid("skipMissing")}>
                    Skip missing covers
                  </ToggleChip>
                </div>
              </div>
            </>
          ) : null}

          <div className="flex flex-col gap-2">
            <span className="text-[13px] text-ink-3">Image size</span>
            <Segmented<string>
              label="Image size"
              value={String(size)}
              onChange={(v) => setParams({ size: v })}
              options={ART_SIZES.map((s) => ({ value: String(s), label: `${s} px` }))}
            />
          </div>
        </Panel>

        <Panel className="lg:col-span-4" title={subject ? `${styleLabel} · ${rangeLabel}` : undefined}>
          {!subject ? (
            <Empty>Enter a username to make stats art.</Empty>
          ) : preview.status === "loading" ? (
            <div className="flex aspect-square w-full max-w-[600px] items-center justify-center rounded-[12px] bg-raised">
              <Loading label="Drawing" />
            </div>
          ) : preview.status === "empty" ? (
            <Empty>
              Stats for {subject} over {rangeLabel.toLowerCase()} aren&apos;t calculated yet. Try a longer range.
            </Empty>
          ) : preview.status === "error" ? (
            <ErrorNote error={preview.error} onRetry={() => setAttempt((n) => n + 1)} />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="mx-auto w-full max-w-[600px] overflow-hidden rounded-[12px] bg-raised">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview.objectUrl} alt={`${styleLabel} for ${subject}, ${rangeLabel}`} className="block h-auto w-full" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" onPress={download}>
                  <ArrowDownToLine className="size-4" />
                  Download SVG
                </Button>
                <Button variant="secondary" onPress={copyLink}>
                  <Copy className="size-4" />
                  Copy link
                </Button>
                <span className="num text-[12px] text-ink-3">{Math.round(preview.blob.size / 1024)} KB</span>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </Page>
  );
}

function withParam(params: URLSearchParams, key: string, value: string) {
  const q = new URLSearchParams(params.toString());
  q.set(key, value);
  return q.toString();
}
