"use client";

import * as React from "react";
import { Link, Page, SwitchRow } from "@/components/ui";
import { SaveBar, SettingsGate, SettingsPanel, SettingsSection, useSave } from "@/components/settings/settings-kit";
import { useApi, useAuth } from "@/lib/auth";

export default function RecommendationsSettingsPage() {
  return (
    <Page
      title="Recommendations"
      subtitle="Playlist generation (Daily Jams, Weekly Jams and Weekly Exploration) on ListenBrainz."
    >
      <SettingsGate what="change your playlist preferences">
        {(user) => <RecommendationsForm token={user.token} />}
      </SettingsGate>
    </Page>
  );
}

function RecommendationsForm({ token }: { token: string }) {
  const api = useApi();
  const { account } = useAuth();
  // Known only with a password sign-in; with a token there is no way to read it, so it starts unknown (null).
  const known = typeof account?.troi?.export_to_spotify === "boolean" ? account.troi.export_to_spotify : null;
  const [value, setValue] = React.useState<boolean | null>(known);
  const [baseline, setBaseline] = React.useState<boolean | null>(known);

  const { save, pending, saved, error } = useSave(async () => {
    if (value === null) throw new Error("Choose a setting first.");
    await api.submitTroiPreferences(token, value);
    setBaseline(value);
  });

  return (
    <div>
      <SettingsSection
        title="Auto-export to Spotify"
        description="When on, ListenBrainz exports your generated playlists to Spotify automatically. You can still export any playlist by hand."
        summary={
          value === null
            ? "With a token, Undertone can't read this setting. Choose one and save, or sign in with your password to see it."
            : value
              ? "Currently set to export automatically."
              : "Currently set not to export automatically."
        }
      >
        <SettingsPanel>
          <SwitchRow
            isSelected={value === true}
            onChange={(on: boolean) => setValue(on)}
            isDisabled={pending}
            label="Export daily and weekly playlists to Spotify"
            description="Needs a Spotify account connected on ListenBrainz."
          />
          <p className="mt-3 text-[13px] text-ink-3">
            Connect Spotify in{" "}
            <Link href="/settings/music-services" className="text-ink-2 underline underline-offset-2">
              Music services
            </Link>
            .
          </p>
          <SaveBar
            dirty={value !== baseline}
            pending={pending}
            saved={saved}
            error={error}
            onSave={save}
          />
        </SettingsPanel>
      </SettingsSection>
    </div>
  );
}
