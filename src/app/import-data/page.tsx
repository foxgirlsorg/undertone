"use client";

import NextLink from "next/link";
import { Link, Page, Panel } from "@/components/ui";
import { OutButton } from "@/components/settings/settings-kit";
import { LB_WEB_URL } from "@/lib/config";

export default function ImportDataPage() {
  return (
    <Page title="Import data" subtitle="There are three ways to get your listening into ListenBrainz.">
      <div className="grid gap-[14px]">
        <Panel title="1. Connect a music service">
          <Step>
            Connect Spotify, Last.fm and other services and ListenBrainz keeps your history in sync on its own. Connection
            is set up in{" "}
            <Link href="/settings/music-services" className="text-white underline underline-offset-2">
              Music services
            </Link>
            , because it needs your website session.
          </Step>
        </Panel>

        <Panel title="2. Submit listens from a player or scrobbler">
          <Step>
            Many players and scrobblers can send listens straight to ListenBrainz with your user token. Each one has its
            own setup. The official guide to submitting data is on the website.
          </Step>
          <div className="mt-4">
            <OutButton href={`${LB_WEB_URL}/add-data/`}>Submitting data on listenbrainz.org</OutButton>
          </div>
        </Panel>

        <Panel title="3. Import a history file">
          <Step>
            Upload an export you already have from Spotify, Libre.fm, Maloja, PanoScrobbler, Rockbox, Spinitron or
            ListenBrainz itself. To avoid duplicates, limit the import to a date range that does not overlap what you
            already have.
          </Step>
          <div className="mt-4">
            <NextLink
              href="/settings/import"
              className="inline-flex h-10 items-center rounded-full bg-white px-4 text-[14px] font-medium text-black hover:bg-[#e6e6e6]"
            >
              Import a file
            </NextLink>
          </div>
        </Panel>
      </div>
    </Page>
  );
}

function Step({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] leading-6 text-ink-2">{children}</p>;
}
