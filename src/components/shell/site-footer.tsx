import NextLink from "next/link";
import { REPO_URL } from "@/lib/config";

const ext = "text-ink-2 underline-offset-2 hover:text-white hover:underline";

export function SiteFooter() {
  return (
    <footer className="mx-auto mb-28 mt-16 w-full max-w-[1152px] border-t border-[#1a1a1a] px-4 pt-8 text-[13px] leading-5 text-ink-3 sm:px-6 xl:px-0">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-[640px] space-y-2">
          <p>
            Undertone is an independent, unofficial client for{" "}
            <a href="https://listenbrainz.org" className={ext} target="_blank" rel="noreferrer">
              ListenBrainz
            </a>
            . Every listen, statistic, playlist and recommendation comes from the{" "}
            <a href="https://listenbrainz.readthedocs.io/" className={ext} target="_blank" rel="noreferrer">
              ListenBrainz API
            </a>
            , built and run by the{" "}
            <a href="https://metabrainz.org" className={ext} target="_blank" rel="noreferrer">
              MetaBrainz Foundation
            </a>
            , a non-profit. Music metadata is from{" "}
            <a href="https://musicbrainz.org" className={ext} target="_blank" rel="noreferrer">
              MusicBrainz
            </a>
            , cover art from the{" "}
            <a href="https://coverartarchive.org" className={ext} target="_blank" rel="noreferrer">
              Cover Art Archive
            </a>
            .
          </p>
          <p>
            ListenBrainz data is released under{" "}
            <a href="https://creativecommons.org/publicdomain/zero/1.0/" className={ext} target="_blank" rel="noreferrer">
              CC0
            </a>
            . ListenBrainz and MusicBrainz are projects of the MetaBrainz Foundation; Undertone is not affiliated with or endorsed by them.{" "}
            <a href="https://metabrainz.org/donate" className={ext} target="_blank" rel="noreferrer">
              Support MetaBrainz
            </a>
            .
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-4 sm:gap-y-2">
          <NextLink href="/about" className="inline-flex min-h-11 items-center hover:text-white sm:min-h-0">About</NextLink>
          <NextLink href="/statistics" className="inline-flex min-h-11 items-center hover:text-white sm:min-h-0">Site stats</NextLink>
          <NextLink href="/current-status" className="inline-flex min-h-11 items-center hover:text-white sm:min-h-0">Status</NextLink>
          <NextLink href="/data" className="inline-flex min-h-11 items-center hover:text-white sm:min-h-0">Data</NextLink>
          <NextLink href="/donors" className="inline-flex min-h-11 items-center hover:text-white sm:min-h-0">Donors</NextLink>
          <a href="https://github.com/metabrainz/listenbrainz-server" className="inline-flex min-h-11 items-center hover:text-white sm:min-h-0" target="_blank" rel="noreferrer">
            ListenBrainz source
          </a>
        </nav>
      </div>
      <p className="mt-6">
        Undertone&apos;s server stores nothing about you: no passwords, sessions, settings or listening data. Your sign-in
        stays in your own browser.{" "}
        <a href={REPO_URL} className={ext} target="_blank" rel="noreferrer">
          It&apos;s open source
        </a>
        , so you can check.
      </p>
      <p className="mt-3 text-ink-2">
        ©{" "}
        <a href="https://foxgirls.org" className={ext} target="_blank" rel="noreferrer">
          foxgirls.org
        </a>
      </p>
    </footer>
  );
}
