"use client";

/*
  PlayerBar — the fixed bottom player. Hidden while the queue is empty; Close empties the queue.
  Desktop (>=768px): an 80px bar. Track (cover, title, artist, source or error) | transport over a slim
  progress track | love, volume, queue, video, close.
  Phone (<768px): a 64px bar above the safe area with a 2px progress line on top. Tapping the title
  opens the full-screen "Now playing" sheet (seek, transport, queue).
  Space toggles playback unless focus is on a control.
*/

import * as React from "react";
import NextLink from "next/link";
import { Button, Sheet, Slider, toast } from "@heroui/react";
import {
  BackwardStep,
  ChevronsCollapseUpRight,
  ChevronsExpandUpRight,
  ForwardStep,
  Heart,
  HeartFill,
  ListUl,
  Pause,
  Play,
  Volume,
  VolumeSlash,
  Xmark,
} from "@gravity-ui/icons";
import { CoverArt } from "@/components/ui";
import { ListenCard } from "@/components/listen/listen-card";
import { useAuth } from "@/lib/auth";
import { useListFeedback } from "@/lib/feedback";
import {
  getArtistCredits,
  getArtistName,
  getCoverArt,
  getRecordingMBID,
  getRecordingMSID,
  getReleaseName,
  getTrackName,
  listenKey,
} from "@/lib/listen";
import { fmtDuration } from "@/lib/format";
import { usePlayer } from "./player-context";
import { usePlayerVideo } from "./player-video-context";

const first = (v: number | number[]) => (Array.isArray(v) ? v[0] : v);

const SOURCE_LABEL = {
  youtube: "YouTube",
  "internet-archive": "Internet Archive",
  spotify: "Spotify",
} as const;

/** Artist names, linked to the first credited artist when we know its MBID. */
function ArtistLine({ listen }: { listen: Listen }) {
  const name = getArtistName(listen);
  const mbid = getArtistCredits(listen)[0]?.artist_mbid;
  if (mbid) {
    return (
      <NextLink href={`/artist/${mbid}`} className="rounded-sm hover:text-white focus-visible:outline-2 focus-visible:outline-white">
        {name}
      </NextLink>
    );
  }
  return <span>{name}</span>;
}

function TrackTitle({ listen }: { listen: Listen }) {
  const title = getTrackName(listen);
  const mbid = getRecordingMBID(listen);
  if (mbid) {
    return (
      <NextLink href={`/track/${mbid}`} className="rounded-sm hover:text-data focus-visible:outline-2 focus-visible:outline-white">
        {title}
      </NextLink>
    );
  }
  return <span>{title}</span>;
}

/** The queue as cards, each with a remove button. */
function QueueList({
  queue,
  feedback,
  onRemove,
}: {
  queue: Listen[];
  feedback: (l: Listen) => ListenFeedBack | undefined;
  onRemove: (index: number) => void;
}) {
  return (
    <ol className="flex flex-col gap-0.5">
      {queue.map((l, i) => (
        <li key={listenKey(l, i)}>
          <ListenCard
            listen={l}
            context={queue}
            feedback={feedback(l)}
            compact
            aside={
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label={`Remove ${getTrackName(l)} from queue`}
                onPress={() => onRemove(i)}
                className="text-ink-3"
              >
                <Xmark className="size-4" />
              </Button>
            }
          />
        </li>
      ))}
    </ol>
  );
}

export function PlayerBar() {
  const p = usePlayer();
  const video = usePlayerVideo();
  const { api, user } = useAuth();
  const fb = useListFeedback(p.queue);
  const [queueOpen, setQueueOpen] = React.useState(false);
  const [nowOpen, setNowOpen] = React.useState(false);
  const [dragMs, setDragMs] = React.useState<number | null>(null);
  const [mutedFrom, setMutedFrom] = React.useState<number | null>(null);
  const [loved, setLoved] = React.useState<{ key: string; score: ListenFeedBack } | null>(null);

  const { toggle } = p;
  const hasCurrent = !!p.current;
  const queueLength = p.queue.length;

  // Space toggles playback, except while focus is in a field or on a control that uses Space.
  React.useEffect(() => {
    if (!hasCurrent) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " && e.code !== "Space") return;
      if (e.repeat || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t) {
        if (t.isContentEditable) return;
        if (/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(t.tagName)) return;
        if (t.closest("[role='dialog'], [role='slider'], [role='listbox'], [role='menu']")) return;
      }
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasCurrent, toggle]);

  // Closing the player (empty queue) closes its sheets too, so they do not reopen with the next queue.
  if (queueLength === 0) {
    if (queueOpen || nowOpen) {
      setQueueOpen(false);
      setNowOpen(false);
    }
    return null;
  }

  const current = p.current;
  const max = Math.max(p.durationMs, 1);
  const shown = dragMs ?? p.progressMs;
  const pct = p.durationMs > 0 ? Math.min(100, (p.progressMs / p.durationMs) * 100) : 0;
  const coverAlt = (current && (getReleaseName(current) || getTrackName(current))) || "Now playing";
  const playLabel = p.isPlaying ? "Pause" : "Play";
  const muted = p.volume === 0;

  // Love: the same feedback call as ListenCard, with an optimistic local state for the current track.
  const currentKey = current ? listenKey(current, p.index) : "";
  const score: ListenFeedBack =
    loved && loved.key === currentKey ? loved.score : current ? (fb.get(current) ?? 0) : 0;
  const recMBID = current ? getRecordingMBID(current) ?? undefined : undefined;
  const recMSID = current ? getRecordingMSID(current) ?? undefined : undefined;
  const canLove = !!current && !!(recMBID || recMSID);

  const toggleLove = async () => {
    if (!current || !user || !canLove) return;
    const next: ListenFeedBack = score === 1 ? 0 : 1;
    setLoved({ key: currentKey, score: next });
    try {
      await api.submitFeedback(user.token, next, recMSID, recMBID);
    } catch (e) {
      setLoved({ key: currentKey, score });
      toast.danger("Couldn't save feedback", { description: (e as Error).message });
    }
  };

  const toggleMute = () => {
    if (muted) {
      p.setVolume(mutedFrom && mutedFrom > 0 ? mutedFrom : 80);
      setMutedFrom(null);
    } else {
      setMutedFrom(p.volume);
      p.setVolume(0);
    }
  };

  // What the bar says about the source: a playback error, else where the track plays from.
  const error = p.error;
  let sourceLine = "";
  if (!error && current && p.source !== "none") sourceLine = SOURCE_LABEL[p.source];
  else if (!error && current && p.isPlaying) sourceLine = "Finding a source";

  const seekSlider = (className: string, thumbClass: string, trackClass: string) => (
    <Slider
      aria-label="Seek"
      className={className}
      minValue={0}
      maxValue={max}
      value={shown}
      isDisabled={!p.durationMs}
      onChange={(v) => setDragMs(first(v))}
      onChangeEnd={(v) => {
        setDragMs(null);
        p.seek(first(v));
      }}
    >
      <Slider.Track className={trackClass}>
        <Slider.Fill className="rounded-full bg-data" />
        <Slider.Thumb className={thumbClass} />
      </Slider.Track>
    </Slider>
  );

  return (
    <>
      {/* Desktop */}
      <div className="fixed inset-x-0 bottom-0 z-50 hidden h-20 border-t border-[#1a1a1a] bg-black md:block">
        <div className="mx-auto grid h-full w-full max-w-[1152px] grid-cols-[minmax(0,1fr)_minmax(0,340px)_minmax(0,1fr)] items-center gap-6 px-4 sm:px-6 xl:px-0">
          <div className="flex min-w-0 items-center gap-3">
            <CoverArt src={getCoverArt(current, 250)} alt={coverAlt} size={56} rounded={6} />
            <div className="min-w-0 flex-1">
              {current ? (
                <>
                  <div className="truncate text-[14px] font-medium leading-5">
                    <TrackTitle listen={current} />
                  </div>
                  <div className="truncate text-[13px] leading-5 text-ink-2">
                    <ArtistLine listen={current} />
                  </div>
                </>
              ) : null}
              <div className="flex min-w-0 items-center gap-2 text-[12px] leading-5" aria-live="polite">
                {error ? (
                  <>
                    <span className="truncate text-ink-2">{error}</span>
                    <button
                      type="button"
                      onClick={p.next}
                      className="flex-none rounded-sm px-1 font-medium text-white hover:underline focus-visible:outline-2 focus-visible:outline-white"
                    >
                      Skip
                    </button>
                  </>
                ) : (
                  <span className="truncate text-ink-3">{sourceLine}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-col items-center gap-1.5">
            <div className="flex items-center gap-3">
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label="Previous track"
                onPress={p.previous}
                isDisabled={!current}
                className="text-ink-2"
              >
                <BackwardStep className="size-4" />
              </Button>
              <Button
                isIconOnly
                aria-label={playLabel}
                onPress={p.toggle}
                isDisabled={!current}
                className="size-10 min-w-10 rounded-full"
              >
                {p.isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
              </Button>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label="Next track"
                onPress={p.next}
                isDisabled={!current}
                className="text-ink-2"
              >
                <ForwardStep className="size-4" />
              </Button>
            </div>
            <div className="group flex w-full items-center gap-3 text-[12px] text-ink-3">
              <span className="num w-10 flex-none text-right">{fmtDuration(shown)}</span>
              {seekSlider(
                "min-w-0 flex-1",
                "size-3 bg-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
                "h-1 rounded-full bg-[#2a2a2a]"
              )}
              <span className="num w-10 flex-none">{p.durationMs ? fmtDuration(p.durationMs) : "—"}</span>
            </div>
          </div>

          <div className="flex min-w-0 items-center justify-end gap-0.5">
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label={score === 1 ? "Remove love" : "Love this track"}
              aria-pressed={score === 1}
              onPress={toggleLove}
              isDisabled={!canLove || !user}
              className={score === 1 ? "text-data" : "text-ink-2"}
            >
              {score === 1 ? <HeartFill className="size-4" /> : <Heart className="size-4" />}
            </Button>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label={muted ? "Unmute" : "Mute"}
              onPress={toggleMute}
              className="text-ink-2"
            >
              {muted ? <VolumeSlash className="size-4" /> : <Volume className="size-4" />}
            </Button>
            <Slider
              aria-label="Volume"
              className="group hidden w-24 flex-none lg:flex"
              minValue={0}
              maxValue={100}
              value={p.volume}
              onChange={(v) => p.setVolume(first(v))}
            >
              <Slider.Track className="h-1 rounded-full bg-[#2a2a2a]">
                <Slider.Fill className="rounded-full bg-white" />
                <Slider.Thumb className="size-3 bg-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" />
              </Slider.Track>
            </Slider>
            <span className="relative">
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label={`Queue, ${queueLength} ${queueLength === 1 ? "track" : "tracks"}`}
                onPress={() => setQueueOpen(true)}
                className="text-ink-2"
              >
                <ListUl className="size-4" />
              </Button>
              <span
                aria-hidden
                className="num pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-medium leading-none text-black"
              >
                {queueLength}
              </span>
            </span>
            {p.source === "youtube" ? (
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label={video.expanded ? "Hide video" : "Show video"}
                aria-pressed={video.expanded}
                onPress={() => video.setExpanded(!video.expanded)}
                className="text-ink-2"
              >
                {video.expanded ? (
                  <ChevronsCollapseUpRight className="size-4" />
                ) : (
                  <ChevronsExpandUpRight className="size-4" />
                )}
              </Button>
            ) : null}
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label="Close player"
              onPress={p.clearQueue}
              className="text-ink-2"
            >
              <Xmark className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Phone */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 border-t border-[#1a1a1a] bg-black md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-[#2a2a2a]">
          <div className="h-full bg-data" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex h-16 items-center gap-2 px-2">
          <button
            type="button"
            onClick={() => setNowOpen(true)}
            aria-label="Open now playing"
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md text-left focus-visible:outline-2 focus-visible:outline-white"
          >
            <CoverArt src={getCoverArt(current, 250)} alt={coverAlt} size={44} rounded={6} />
            <span className="min-w-0 flex-1">
              {current ? (
                <>
                  <span className="block truncate text-[14px] font-medium leading-5">{getTrackName(current)}</span>
                  <span className={`block truncate text-[13px] leading-5 ${error ? "text-ink-3" : "text-ink-2"}`}>
                    {error ?? getArtistName(current)}
                  </span>
                </>
              ) : null}
            </span>
          </button>
          <Button
            isIconOnly
            aria-label={playLabel}
            onPress={p.toggle}
            isDisabled={!current}
            className="size-11 min-w-11 rounded-full"
          >
            {p.isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
          </Button>
          <Button
            isIconOnly
            variant="ghost"
            aria-label="Next track"
            onPress={p.next}
            isDisabled={!current}
            className="size-11 min-w-11 text-ink-2"
          >
            <ForwardStep className="size-5" />
          </Button>
          <Button
            isIconOnly
            variant="ghost"
            aria-label="Close player"
            onPress={p.clearQueue}
            className="size-11 min-w-11 text-ink-2"
          >
            <Xmark className="size-5" />
          </Button>
        </div>
      </div>

      {/* Phone: now playing */}
      <Sheet isOpen={nowOpen} onOpenChange={setNowOpen} placement="bottom">
        <Sheet.Backdrop>
          <Sheet.Content>
            <Sheet.Dialog className="max-h-[92dvh] w-full bg-black">
              <Sheet.Header className="flex items-center justify-between gap-3 px-4 pt-4">
                <Sheet.Heading className="text-[16px] font-medium leading-6">Now playing</Sheet.Heading>
                <Button slot="close" isIconOnly variant="ghost" aria-label="Close now playing" className="size-11 min-w-11">
                  <Xmark className="size-5" />
                </Button>
              </Sheet.Header>
              <Sheet.Body className="flex flex-col gap-6 px-4 pb-[calc(24px+env(safe-area-inset-bottom))]">
                <div className="mx-auto w-full max-w-[320px] [&>*]:!aspect-square [&>*]:!h-auto [&>*]:!w-full">
                  <CoverArt src={getCoverArt(current, 500)} alt={coverAlt} size={320} rounded={12} />
                </div>
                <div className="min-w-0">
                  {current ? (
                    <>
                      <h2 className="truncate text-[20px] font-semibold leading-7">
                        <TrackTitle listen={current} />
                      </h2>
                      <p className="truncate text-[14px] leading-5 text-ink-2">
                        <ArtistLine listen={current} />
                      </p>
                    </>
                  ) : null}
                  <p className="mt-1 flex min-w-0 items-center gap-2 text-[13px] leading-5" aria-live="polite">
                    {error ? (
                      <>
                        <span className="truncate text-ink-2">{error}</span>
                        <button
                          type="button"
                          onClick={p.next}
                          className="flex-none rounded-sm px-1 font-medium text-white hover:underline focus-visible:outline-2 focus-visible:outline-white"
                        >
                          Skip
                        </button>
                      </>
                    ) : (
                      <span className="truncate text-ink-3">{sourceLine}</span>
                    )}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {seekSlider(
                    "w-full",
                    "size-5 bg-white",
                    "h-1.5 rounded-full bg-[#2a2a2a]"
                  )}
                  <div className="num flex justify-between text-[12px] text-ink-3">
                    <span>{fmtDuration(shown)}</span>
                    <span>{p.durationMs ? fmtDuration(p.durationMs) : "—"}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Button
                    isIconOnly
                    variant="ghost"
                    aria-label="Previous track"
                    onPress={p.previous}
                    isDisabled={!current}
                    className="size-11 min-w-11 text-ink-2"
                  >
                    <BackwardStep className="size-6" />
                  </Button>
                  <Button
                    isIconOnly
                    aria-label={playLabel}
                    onPress={p.toggle}
                    isDisabled={!current}
                    className="size-16 min-w-16 rounded-full"
                  >
                    {p.isPlaying ? <Pause className="size-6" /> : <Play className="size-6" />}
                  </Button>
                  <Button
                    isIconOnly
                    variant="ghost"
                    aria-label="Next track"
                    onPress={p.next}
                    isDisabled={!current}
                    className="size-11 min-w-11 text-ink-2"
                  >
                    <ForwardStep className="size-6" />
                  </Button>
                </div>
                <div className="hidden items-center gap-3 sm:flex">
                  <Button
                    isIconOnly
                    variant="ghost"
                    aria-label={muted ? "Unmute" : "Mute"}
                    onPress={toggleMute}
                    className="size-11 min-w-11 text-ink-2"
                  >
                    {muted ? <VolumeSlash className="size-5" /> : <Volume className="size-5" />}
                  </Button>
                  <Slider
                    aria-label="Volume"
                    className="min-w-0 flex-1"
                    minValue={0}
                    maxValue={100}
                    value={p.volume}
                    onChange={(v) => p.setVolume(first(v))}
                  >
                    <Slider.Track className="h-1.5 rounded-full bg-[#2a2a2a]">
                      <Slider.Fill className="rounded-full bg-white" />
                      <Slider.Thumb className="size-5 bg-white" />
                    </Slider.Track>
                  </Slider>
                </div>
                <section aria-labelledby="now-queue-heading">
                  <h3 id="now-queue-heading" className="mb-3 text-[16px] font-medium leading-6">
                    Queue
                  </h3>
                  <QueueList queue={p.queue} feedback={(l) => fb.get(l)} onRemove={p.removeFromQueue} />
                </section>
              </Sheet.Body>
            </Sheet.Dialog>
          </Sheet.Content>
        </Sheet.Backdrop>
      </Sheet>

      {/* Desktop: queue */}
      <Sheet isOpen={queueOpen} onOpenChange={setQueueOpen} placement="right">
        <Sheet.Backdrop>
          <Sheet.Content>
            <Sheet.Dialog className="h-full w-full max-w-[420px] bg-card">
              <Sheet.Header className="flex items-center justify-between gap-3 px-[22px] pt-[22px]">
                <div className="min-w-0">
                  <Sheet.Heading className="text-[16px] font-medium leading-6">Queue</Sheet.Heading>
                  <p className="num text-[12px] text-ink-3">
                    {queueLength} {queueLength === 1 ? "track" : "tracks"}
                  </p>
                </div>
                <div className="flex flex-none items-center gap-1">
                  <Button
                    size="sm"
                    variant="tertiary"
                    onPress={() => {
                      setQueueOpen(false);
                      p.clearQueue();
                    }}
                  >
                    Clear
                  </Button>
                  <Button slot="close" isIconOnly size="sm" variant="ghost" aria-label="Close queue">
                    <Xmark className="size-4" />
                  </Button>
                </div>
              </Sheet.Header>
              <Sheet.Body className="px-[22px] pb-[22px]">
                <QueueList queue={p.queue} feedback={(l) => fb.get(l)} onRemove={p.removeFromQueue} />
              </Sheet.Body>
            </Sheet.Dialog>
          </Sheet.Content>
        </Sheet.Backdrop>
      </Sheet>
    </>
  );
}
