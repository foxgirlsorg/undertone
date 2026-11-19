import { Page } from "@/components/ui";
import { OutButton, SettingsPanel, SettingsSection } from "@/components/settings/settings-kit";
import { LB_WEB_URL } from "@/lib/config";

export default function DeleteListensSettingsPage() {
  return (
    <Page title="Delete listens" subtitle="Remove listens from your ListenBrainz history.">
      <div>
        <SettingsSection
          title="Bulk deletion"
          description="Deleting listens is handled on listenbrainz.org, which needs your website session."
        >
          <SettingsPanel className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[14px] text-ink-2">Deletions are scheduled and usually run shortly after the hour.</p>
            <OutButton href={`${LB_WEB_URL}/settings/delete-listens/`}>Open on ListenBrainz</OutButton>
          </SettingsPanel>
        </SettingsSection>
      </div>
    </Page>
  );
}
