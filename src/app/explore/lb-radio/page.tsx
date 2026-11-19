"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, TextField, Input, Label, toast } from "@heroui/react";
import { Page, Panel, Empty, ErrorNote, Loading, SignInPrompt, cx } from "@/components/ui";
import { ListenCard } from "@/components/listen/listen-card";
import { useAuth } from "@/lib/auth";
import { useListFeedback } from "@/lib/feedback";
import { jspfTrackToListen } from "@/lib/listen";
import { fmtInt } from "@/lib/format";
import { Modes } from "@/lib/enums";
import { usePlayer } from "@/components/player/player-context";
import { Segmented } from "@/components/explore/segmented";
import { PromptSyntax } from "@/components/explore/prompt-syntax";
import {
  LB_RADIO_MODES,
  enrichTracks,
  isLBRadioMode,
  recordingMBIDFromTrack,
  type LBRadioMode,
  type RecordingMetadataMap,
} from "@/components/explore/lb-radio";

type RadioResult = { jspf: JSPFObject; feedback: string[] };

const MODE_OPTIONS = LB_RADIO_MODES.map((m) => ({ value: m, label: m[0].toUpperCase() + m.slice(1) }));

export default function LBRadioPage() {
  return (
    <Suspense fallback={null}>
      <LBRadio />
    </Suspense>
  );
}

function LBRadio() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { api, user } = useAuth();
  const player = usePlayer();

  const urlPrompt = searchParams.get("prompt") ?? "";
  const urlMode = searchParams.get("mode");
  const urlModeValid: LBRadioMode = isLBRadioMode(urlMode) ? urlMode : "easy";

  const [prompt, setPrompt] = React.useState(urlPrompt);
  const [mode, setMode] = React.useState<LBRadioMode>(urlModeValid);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);
  const [result, setResult] = React.useState<RadioResult | null>(null);
  const [savedMBID, setSavedMBID] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  // The last URL prompt+mode we generated for, so a ?prompt= link runs once per visit.
  const autoRanFor = React.useRef<string | null>(null);

  const generate = React.useCallback(
    async (p: string, m: LBRadioMode, updateUrl: boolean) => {
      if (!user) return;
      const key = `${p}|${m}`;
      autoRanFor.current = key;
      if (updateUrl) {
        router.replace(`/explore/lb-radio?prompt=${encodeURIComponent(p)}&mode=${m}`, { scroll: false });
      }
      setLoading(true);
      setError(null);
      setSavedMBID(null);
      try {
        const res = await api.getLBRadioPlaylist(user.token, p, m as Modes);
        const jspf = res.payload.jspf;
        const tracks = jspf?.playlist?.track ?? [];
        if (tracks.length) {
          const mbids = Array.from(new Set(tracks.map(recordingMBIDFromTrack).filter(Boolean))) as string[];
          let meta: RecordingMetadataMap | null = null;
          try {
            meta = (await api.getRecordingMetadata(mbids)) as RecordingMetadataMap | null;
          } catch {
            // Cover art is a nicety: the playlist still shows without it.
            meta = null;
          }
          enrichTracks(tracks, meta);
        }
        setResult({ jspf, feedback: res.payload.feedback ?? [] });
      } catch (e) {
        setError(e);
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [api, user, router]
  );

  // ?prompt=&mode= support: run once the user is known.
  React.useEffect(() => {
    if (!user || urlPrompt.trim().length <= 3) return;
    const key = `${urlPrompt}|${urlModeValid}`;
    if (autoRanFor.current === key) return;
    setPrompt(urlPrompt);
    setMode(urlModeValid);
    void generate(urlPrompt, urlModeValid, false);
  }, [user, urlPrompt, urlModeValid, generate]);

  const tracks = React.useMemo(() => result?.jspf?.playlist?.track ?? [], [result]);
  const listens = React.useMemo(() => tracks.map(jspfTrackToListen), [tracks]);
  const fb = useListFeedback(listens);
  const playlist = result?.jspf?.playlist;

  const save = async () => {
    if (!user || !playlist) return;
    setSaving(true);
    try {
      const mbid = await api.createPlaylist(user.token, { playlist: { ...playlist, track: tracks } } as JSPFObject);
      setSavedMBID(mbid);
      toast.success("Playlist saved", { description: playlist.title });
    } catch (e) {
      toast.danger("Couldn't save the playlist", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const canGenerate = prompt.trim().length > 3 && !!user && !loading;

  return (
    <Page
      title="LB Radio"
      subtitle="Describe the music you want in a short prompt. ListenBrainz builds a playlist from listening data."
    >
      <Panel>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canGenerate) void generate(prompt.trim(), mode, true);
          }}
        >
          <TextField value={prompt} onChange={setPrompt} name="prompt" className="w-full">
            <Label>Prompt</Label>
            <Input placeholder="artist:(radiohead) or #metal" autoComplete="off" spellCheck={false} />
          </TextField>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Segmented<LBRadioMode>
              label="Mode"
              value={mode}
              onChange={setMode}
              options={MODE_OPTIONS}
            />
            <Button type="submit" variant="primary" isDisabled={!canGenerate} className="sm:self-auto">
              {loading ? "Generating…" : "Generate"}
            </Button>
          </div>

          <PromptSyntax />

          <div className="flex flex-wrap gap-2 text-[13px] text-ink-3">
            <span>Try:</span>
            {["artist:(radiohead)", "tag:(trip hop)", "#metal", "stats:rob"].map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setPrompt(ex)}
                className="inline-flex min-h-10 items-center rounded-full bg-[#1c1c1c] px-3 py-1 font-mono sm:min-h-0 text-[12px] text-ink-2 hover:text-white"
              >
                {ex}
              </button>
            ))}
          </div>
        </form>
      </Panel>

      {!user && user !== undefined ? <SignInPrompt what="generate a radio playlist" /> : null}

      {loading ? (
        <Panel>
          <Loading label="Generating playlist" />
        </Panel>
      ) : error ? (
        <ErrorNote
          error={error}
          onRetry={() => {
            if (user) void generate(prompt.trim() || urlPrompt, mode, true);
          }}
        />
      ) : result ? (
        <>
          {result.feedback.length ? (
            <Panel title="Query feedback">
              <ul className="flex list-disc flex-col gap-1 pl-5 text-[14px] text-ink-2">
                {result.feedback.map((f, i) => (
                  <li key={`${i}-${f}`}>{f}</li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {tracks.length === 0 ? (
            <Empty>No playlist was generated. Try a broader prompt or a different mode.</Empty>
          ) : (
            <Panel
              title={playlist?.title || "Playlist"}
              aside={
                <div className="flex flex-wrap items-center gap-2">
                  <span className="num">{fmtInt(tracks.length)} tracks</span>
                  <Button size="sm" variant="secondary" onPress={() => player.playQueue(listens, 0)}>
                    Play all
                  </Button>
                  {user ? (
                    savedMBID ? (
                      <Button size="sm" variant="tertiary" onPress={() => router.push(`/playlist/${savedMBID}`)}>
                        Open saved playlist
                      </Button>
                    ) : (
                      <Button size="sm" variant="tertiary" isDisabled={saving} onPress={save}>
                        {saving ? "Saving…" : "Save playlist"}
                      </Button>
                    )
                  ) : null}
                </div>
              }
            >
              {playlist?.annotation ? <p className="mb-3 text-[13px] text-ink-2">{playlist.annotation}</p> : null}
              <div className={cx("flex flex-col")}>
                {listens.map((l, i) => (
                  <ListenCard
                    key={`${recordingMBIDFromTrack(tracks[i]) ?? i}-${i}`}
                    listen={l}
                    context={listens}
                    feedback={fb.get(l)}
                    rank={i + 1}
                    canDelete={false}
                  />
                ))}
              </div>
            </Panel>
          )}
        </>
      ) : null}
    </Page>
  );
}
