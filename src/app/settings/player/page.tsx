"use client";

import * as React from "react";
import { Button, toast } from "@heroui/react";
import { Loading, Page, SwitchRow } from "@/components/ui";
import { OutButton, PasswordGate, SaveBar, SettingsPanel, SettingsSection, useMounted, useSave } from "@/components/settings/settings-kit";
import {
  ALL_BRAINZ_SOURCE_IDS,
  hasSavedThisTab,
  normalizeBrainzSettings,
  readBrainzSettingsOrDefault,
  readSubmitListens,
  readYoutubeApiKey,
  rememberBrainzSettings,
  SOURCE_INFO,
  writeSubmitListens,
  type BrainzSourceId,
} from "@/components/settings/player-prefs";
import { useAuth } from "@/lib/auth";
import { isSpotifyConnected, SPOTIFY_SETTINGS_URL, spotifyCanStream, spotifyConfigured, subscribeSpotify } from "@/lib/spotify";

export default function PlayerSettingsPage() {
  const mounted = useMounted();
  const { user } = useAuth();
  return (
    <Page title="Player" subtitle="How Undertone plays music, and which sources it uses.">
      {mounted && user !== undefined ? (
        <PasswordGate what="your player settings">
          <PlayerForm />
        </PasswordGate>
      ) : (
        <Loading label="Reading your player settings" />
      )}
    </Page>
  );
}

function PlayerForm() {
  return (
    <div>
      <BrainzSettingsForm />
      <SpotifySection />
      <BrowserOnlySection />
    </div>
  );
}

const sameSettings = (a: BrainzPlayerSettings, b: BrainzPlayerSettings) =>
  JSON.stringify(normalizeBrainzSettings(a)) === JSON.stringify(normalizeBrainzSettings(b));

/** The whole ListenBrainz BrainzPlayer object, edited as one. Saving sends every field. */
function BrainzSettingsForm() {
  const { api, user, account } = useAuth();
  // A password sign-in reads the real settings. With a token ListenBrainz can't hand them back, so unless
  // they were saved in this tab these are the defaults.
  const [savedHere] = React.useState(() => !!account?.brainzplayer || hasSavedThisTab());
  const [initial] = React.useState(() =>
    account?.brainzplayer ? normalizeBrainzSettings(account.brainzplayer) : readBrainzSettingsOrDefault()
  );
  const [draft, setDraft] = React.useState<BrainzPlayerSettings>(initial);
  const [baseline, setBaseline] = React.useState<BrainzPlayerSettings>(initial);

  const setFlag = (key: keyof Omit<BrainzPlayerSettings, "dataSourcesPriority">, on: boolean) =>
    setDraft((d) => {
      const next = { ...d };
      next[key] = on;
      return next;
    });

  const enabledKeyOf = (id: BrainzSourceId) => SOURCE_INFO[id].enabledKey;

  const toggleSource = (id: BrainzSourceId, on: boolean) => setFlag(enabledKeyOf(id), on);

  const move = (id: BrainzSourceId, delta: -1 | 1) =>
    setDraft((d) => {
      const order = [...d.dataSourcesPriority];
      const i = order.indexOf(id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= order.length) return d;
      [order[i], order[j]] = [order[j], order[i]];
      return { ...d, dataSourcesPriority: order };
    });

  const signedIn = !!user;
  const { save, pending, saved, error } = useSave(async () => {
    if (!user) throw new Error("Sign in to save your player settings to ListenBrainz.");
    const next = normalizeBrainzSettings(draft);
    // ListenBrainz replaces its whole BrainzPlayer object, so the full set is sent every time.
    await api.submitBrainzplayerPreferences(user.token, next);
    rememberBrainzSettings(next);
    setBaseline(next);
    toast.success("Saved to ListenBrainz");
  });

  const enabledCount = draft.dataSourcesPriority.filter((id) => draft[enabledKeyOf(id)]).length;
  const firstPlayable = draft.dataSourcesPriority.find((id) => draft[enabledKeyOf(id)] && SOURCE_INFO[id].playable);

  return (
    <>
      <SettingsSection
        title="Player"
        description="Saved to ListenBrainz."
      >
        <SettingsPanel className="flex flex-col gap-4">
          <SwitchRow
            isSelected={draft.brainzplayerEnabled}
            onChange={(v: boolean) => setFlag("brainzplayerEnabled", v)}
            label="Enable the player"
            description="When off, Undertone won't start tracks."
          />
          <SwitchRow
            isSelected={draft.notificationsEnabled}
            onChange={(v: boolean) => setFlag("notificationsEnabled", v)}
            label="Show notifications"
            description="Show a notice when a track can't be played."
          />
        </SettingsPanel>
      </SettingsSection>

      <SettingsSection
        title="Playback sources"
        description="Tried from top to bottom. Saved to ListenBrainz."
        summary={
          enabledCount
            ? `${enabledCount} of ${ALL_BRAINZ_SOURCE_IDS.length} enabled.${firstPlayable ? ` Playing first from ${SOURCE_INFO[firstPlayable].label}.` : " None of them can play in Undertone."}`
            : "All sources are off. Nothing will play."
        }
      >
        <SettingsPanel>
          <ul className="flex flex-col gap-2">
            {draft.dataSourcesPriority.map((id, index) => {
              const info = SOURCE_INFO[id];
              const on = draft[info.enabledKey];
              const spotifyBlocked = id === "spotify" && !spotifyConfigured();
              return (
                <li key={id} className="flex flex-wrap items-center gap-3 rounded-[10px] bg-raised px-3 py-3">
                  <span className="num w-5 text-[13px] text-ink-3">{index + 1}</span>
                  <SwitchRow
                    isSelected={on}
                    isDisabled={spotifyBlocked}
                    onChange={(v: boolean) => toggleSource(id, v)}
                    className="flex-1 basis-[220px]"
                    label={info.label}
                    description={
                      spotifyBlocked
                        ? "Connect it on ListenBrainz first."
                        : info.note
                    }
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-label={`Move ${info.label} up`}
                      isDisabled={index === 0}
                      onPress={() => move(id, -1)}
                    >
                      Up
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-label={`Move ${info.label} down`}
                      isDisabled={index === draft.dataSourcesPriority.length - 1}
                      onPress={() => move(id, 1)}
                    >
                      Down
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>

          {!savedHere && account ? (
            <p className="mt-4 text-[13px] leading-5 text-ink-2">
              Defaults: nothing saved on ListenBrainz yet.
            </p>
          ) : !savedHere ? (
            <p className="mt-4 text-[13px] leading-5 text-ink-2">
              With a token, ListenBrainz doesn&apos;t let Undertone read your player settings, so these are the defaults,
              not what is saved on your account. Check every switch before you save: saving replaces all of them on
              ListenBrainz. Sign in with your password to see the real ones.
            </p>
          ) : null}

          <div className="mt-4 flex flex-col gap-3">
            <p className="text-[12px] leading-5 text-ink-3">
              {signedIn
                ? "Saved to ListenBrainz only."
                : "Sign in to save these to your ListenBrainz account."}
            </p>
            <SaveBar
              dirty={!sameSettings(draft, baseline)}
              pending={pending}
              saved={saved}
              error={error}
              onSave={save}
              disabledReason={user === undefined ? "Checking your sign-in." : !user ? "Sign in to save." : undefined}
            />
          </div>
        </SettingsPanel>
      </SettingsSection>
    </>
  );
}

/** Spotify is the account linked on listenbrainz.org; Undertone uses it and has no Spotify sign-in of its own. */
function SpotifySection() {
  const connected = React.useSyncExternalStore(subscribeSpotify, isSpotifyConnected, () => false);
  const canStream = React.useSyncExternalStore(subscribeSpotify, spotifyCanStream, () => false);

  return (
    <SettingsSection
      title="Spotify"
      description="The account linked on ListenBrainz. Needs Premium."
      summary={!connected ? "Not connected on ListenBrainz." : canStream ? "Connected through ListenBrainz." : "Connected without playback permission."}
    >
      <SettingsPanel className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 basis-[240px] text-[14px] leading-5 text-ink-2">
          {!connected
            ? "No Spotify account is linked to your ListenBrainz account."
            : canStream
              ? "Connected. Spotify tracks play in Undertone."
              : "Spotify is linked, but only for listening history. To play here, reconnect it on ListenBrainz with playback allowed."}
        </p>
        <OutButton href={SPOTIFY_SETTINGS_URL}>{connected ? "Manage on ListenBrainz" : "Connect on ListenBrainz"}</OutButton>
      </SettingsPanel>
    </SettingsSection>
  );
}

/** ListenBrainz has no field for these, and Undertone stores nothing, so they last until the tab closes. */
function BrowserOnlySection() {
  const [submit, setSubmit] = React.useState(() => readSubmitListens());
  const youtubeSearch = readYoutubeApiKey() !== "";
  return (
    <SettingsSection
      title="This browser"
      description="ListenBrainz has no field for these, so they're kept in a cookie here, along with the volume."
    >
      <SettingsPanel className="flex flex-col gap-4">
        <SwitchRow
          isSelected={submit}
          onChange={(v: boolean) => {
            writeSubmitListens(v);
            setSubmit(v);
          }}
          label="Submit listens while playing"
          description="Adds what you play to your listening history."
        />
        <p className="text-[13px] leading-5 text-ink-2">
          {youtubeSearch
            ? "YouTube search is on."
            : "YouTube search is off: only tracks with a YouTube link play there."}
        </p>
      </SettingsPanel>
    </SettingsSection>
  );
}
