"use client";

import { Page, Panel } from "@/components/ui";
import { OutButton } from "@/components/settings/settings-kit";
import { LB_WEB_URL, PRODUCT_NAME } from "@/lib/config";

export default function TermsOfServicePage() {
  return (
    <Page title="Terms of service" subtitle="The terms that cover your ListenBrainz account and data.">
      <Panel>
        <div className="flex flex-col gap-4 text-[14px] leading-6 text-ink-2">
          <p>
            Your use of ListenBrainz is governed by the ListenBrainz terms of service. {PRODUCT_NAME} is an independent
            client and does not have terms of its own for your listening data.
          </p>
          <p>Read the current terms on the official site, which is also where account matters are handled.</p>
          <div>
            <OutButton href={`${LB_WEB_URL}/terms-of-service/`}>Read the terms on listenbrainz.org</OutButton>
          </div>
        </div>
      </Panel>
    </Page>
  );
}
