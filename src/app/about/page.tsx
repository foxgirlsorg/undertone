"use client";

import { Link, Page, Panel } from "@/components/ui";
import { LB_WEB_URL, PRODUCT_NAME } from "@/lib/config";

export default function AboutPage() {
  return (
    <Page title="About" subtitle="What ListenBrainz is, and what this site is.">
      <div className="grid gap-[14px] md:grid-cols-2">
        <Panel title="ListenBrainz">
          <div className="flex flex-col gap-3 text-[14px] leading-6 text-ink-2">
            <p>
              ListenBrainz is an open project that keeps a record of what you listen to. Every play you send becomes a
              listen in your history, and nothing about it is locked to one app: you can export it at any time.
            </p>
            <p>
              From that history it makes statistics, daily and weekly playlists, and recommendations. Its data is open
              too: regular dumps are published, and there is a public API that any client can use.
            </p>
            <p>
              It is run by MetaBrainz and paid for by donations, which are also how people get flairs.
            </p>
            <p>
              <a
                href={LB_WEB_URL}
                target="_blank"
                rel="noreferrer"
                className="text-white underline underline-offset-2 hover:text-data"
              >
                listenbrainz.org
              </a>{" "}
              is the official site.
            </p>
          </div>
        </Panel>

        <Panel title={PRODUCT_NAME}>
          <div className="flex flex-col gap-3 text-[14px] leading-6 text-ink-2">
            <p>
              {PRODUCT_NAME} is an independent, alternative web client for ListenBrainz. It is not made or run by
              MetaBrainz.
            </p>
            <p>
              It talks only to the public ListenBrainz API and to MusicBrainz. There is no server of its own: your token
              stays in this browser and is sent only to ListenBrainz.
            </p>
            <p>
              Use it the same way as the official site: listens, stats, playlists, feedback and settings. Where something
              needs your website session, like account deletion, it links you to listenbrainz.org instead.
            </p>
          </div>
        </Panel>

        <Panel title="Where to go next" className="md:col-span-2">
          <ul className="grid gap-2 text-[14px] sm:grid-cols-2">
            <li>
              <Link href="/current-status">How fresh the data is</Link>
            </li>
            <li>
              <Link href="/data">Data dumps</Link>
            </li>
            <li>
              <Link href="/import-data">Getting listens in</Link>
            </li>
            <li>
              <Link href="/donors">Donors and flairs</Link>
            </li>
            <li>
              <Link href="/terms-of-service">Terms of service</Link>
            </li>
          </ul>
        </Panel>
      </div>
    </Page>
  );
}
