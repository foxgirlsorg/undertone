import { Page } from "@/components/ui";
import { OutButton, SettingsPanel, SettingsSection } from "@/components/settings/settings-kit";
import { LB_WEB_URL } from "@/lib/config";

export default function DeleteAccountSettingsPage() {
  return (
    <Page title="Delete account" subtitle="Closing your ListenBrainz account.">
      <div>
        <SettingsSection
          title="Delete your ListenBrainz account"
          description="Closing the account removes it from ListenBrainz. Undertone cannot do this, because it needs your website session on listenbrainz.org."
        >
          <SettingsPanel className="flex flex-col gap-3">
            <p className="text-[14px] leading-5 text-ink-2">
              Export your data first if you want to keep a copy. The deletion itself is handled entirely on
              listenbrainz.org.
            </p>
            <div className="flex flex-wrap gap-2">
              <OutButton href={`${LB_WEB_URL}/settings/delete/`}>Delete account on ListenBrainz</OutButton>
            </div>
          </SettingsPanel>
        </SettingsSection>
      </div>
    </Page>
  );
}
