import NextLink from "next/link";
import { REPO_URL } from "@/lib/config";
import { Mark } from "@/components/shell/top-bar";

/*
  Footer: what Undertone is and what it keeps, then three link columns, then the credit line.
  Phone: the columns sit two across; every link is a 44px target there.
*/

type FooterLink = { label: string; href: string; external?: boolean };

const COLUMNS: Array<{ title: string; links: FooterLink[] }> = [
  {
    title: "Undertone",
    links: [
      { label: "About", href: "/about" },
      { label: "Source code", href: REPO_URL, external: true },
      { label: "How sign-in works", href: "/login" },
    ],
  },
  {
    title: "ListenBrainz",
    links: [
      { label: "Site statistics", href: "/statistics" },
      { label: "Service status", href: "/current-status" },
      { label: "Data dumps", href: "/data" },
      { label: "Donors", href: "/donors" },
      { label: "listenbrainz.org", href: "https://listenbrainz.org", external: true },
    ],
  },
  {
    title: "Data & credits",
    links: [
      { label: "ListenBrainz API", href: "https://listenbrainz.readthedocs.io/", external: true },
      { label: "MusicBrainz", href: "https://musicbrainz.org", external: true },
      { label: "Cover Art Archive", href: "https://coverartarchive.org", external: true },
      { label: "MetaBrainz Foundation", href: "https://metabrainz.org", external: true },
      { label: "Support MetaBrainz", href: "https://metabrainz.org/donate", external: true },
    ],
  },
];

const linkCls = "inline-flex min-h-11 items-center text-ink-2 transition-colors hover:text-white sm:min-h-0 sm:py-1";
const inlineLink = "text-ink-2 underline-offset-2 hover:text-white hover:underline";

function FooterAnchor({ link }: { link: FooterLink }) {
  if (link.external) {
    return (
      <a href={link.href} className={linkCls} target="_blank" rel="noreferrer">
        {link.label}
      </a>
    );
  }
  return (
    <NextLink href={link.href} className={linkCls}>
      {link.label}
    </NextLink>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto mb-28 mt-16 w-full max-w-[1152px] px-4 text-[13px] leading-5 text-ink-3 sm:px-6 xl:px-0">
      <div className="grid gap-10 rounded-[20px] bg-card p-[22px] md:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)] md:p-8">
        <div className="flex max-w-[420px] flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <Mark size={26} />
            <span className="text-[16px] font-semibold text-white">Undertone</span>
          </div>
          <p className="text-[14px] leading-6 text-ink-2">
            An independent, unofficial client for{" "}
            <a href="https://listenbrainz.org" className={inlineLink} target="_blank" rel="noreferrer">
              ListenBrainz
            </a>
            , the open music listening history run by the non-profit{" "}
            <a href="https://metabrainz.org" className={inlineLink} target="_blank" rel="noreferrer">
              MetaBrainz Foundation
            </a>
            .
          </p>
          <p>
            Undertone&apos;s server keeps no passwords, sessions, settings or listening data. The one thing it keeps is the
            Gravatar key of people who sign in with their password, so their picture shows on their profile, and that can
            be turned off.{" "}
            <a href={REPO_URL} className={inlineLink} target="_blank" rel="noreferrer">
              Read the source
            </a>
            .
          </p>
        </div>

        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3">
          {COLUMNS.map((col) => (
            <div key={col.title} className="min-w-0">
              <h2 className="mb-2 text-[12px] font-medium text-ink-3">{col.title}</h2>
              <ul className="flex flex-col">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <FooterAnchor link={link} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="flex flex-col gap-2 px-1 pt-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <p className="text-ink-2">
          ©{" "}
          <a href="https://foxgirls.org" className={inlineLink} target="_blank" rel="noreferrer">
            foxgirls.org
          </a>
        </p>
        <p className="max-w-[720px] sm:text-right">
          Listens, statistics and recommendations come from the ListenBrainz API; music data from MusicBrainz, cover art
          from the Cover Art Archive. ListenBrainz data is{" "}
          <a href="https://creativecommons.org/publicdomain/zero/1.0/" className={inlineLink} target="_blank" rel="noreferrer">
            CC0
          </a>
          . Not affiliated with or endorsed by the MetaBrainz Foundation.
        </p>
      </div>
    </footer>
  );
}
