"use client";

/*
  About the user, from their public MusicBrainz editor page (bio, languages, user type, subscribers).
  Renders nothing when there is nothing useful to show, so no empty panel appears.
*/

import * as React from "react";
import DOMPurify from "dompurify";
import { Button } from "@heroui/react";
import { Panel, cx } from "@/components/ui";
import { MB_URL } from "@/lib/config";
import { fmtInt } from "@/lib/format";
import { useMBProfile, type MBProfile } from "@/lib/mb-profile";

const BIO_TAGS = ["p", "br", "a", "b", "i"];
const BIO_CLAMP_LINES = 8;

let linkHookInstalled = false;

/** Bio links open in a new tab, without leaking the opener. Installed once, on the client only. */
function installLinkHook() {
  if (linkHookInstalled) return;
  linkHookInstalled = true;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer nofollow");
    }
  });
}

/** The bio is only ever sanitised in the browser; on the server there is no profile data to render anyway. */
function sanitizeBio(html: string): string {
  if (typeof window === "undefined") return "";
  installLinkHook();
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: BIO_TAGS, ALLOWED_ATTR: ["href"] });
}

const hasAbout = (p: MBProfile) =>
  !!p.bioHtml || !!p.languages?.length || !!p.userType?.length || p.subscribers != null;

export function AboutPanel({ name }: { name: string }) {
  const mb = useMBProfile(name);
  if (mb.isLoading) return <AboutSkeleton />;
  const profile = mb.data;
  if (!profile || !hasAbout(profile)) return null;
  return <About name={name} profile={profile} />;
}

function AboutSkeleton() {
  return (
    <Panel title="About">
      <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-2.5">
        <div className="skel h-3 w-full" />
        <div className="skel h-3 w-11/12" />
        <div className="skel h-3 w-2/3" />
      </div>
    </Panel>
  );
}

function About({ name, profile }: { name: string; profile: MBProfile }) {
  const bio = React.useMemo(() => (profile.bioHtml ? sanitizeBio(profile.bioHtml) : ""), [profile.bioHtml]);
  const languages = profile.languages ?? [];
  const userTypes = profile.userType ?? [];

  return (
    <Panel title="About">
      <div className="flex flex-col gap-4">
        {bio ? <Bio html={bio} /> : null}

        {languages.length ? (
          <div>
            <div className="text-[12px] text-ink-3">Languages</div>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {languages.map((l) => (
                <li
                  key={`${l.name}|${l.level}`}
                  className="rounded-full bg-raised px-2.5 py-1 text-[13px] leading-5 text-white"
                >
                  {l.name}
                  {l.level ? <span className="ml-1.5 text-ink-3">{l.level}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {userTypes.length || profile.subscribers != null ? (
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[14px] leading-6">
            {userTypes.length ? (
              <>
                <dt className="text-ink-3">User type</dt>
                <dd className="min-w-0 break-words text-ink-2">{userTypes.join(", ")}</dd>
              </>
            ) : null}
            {profile.subscribers != null ? (
              <>
                <dt className="text-ink-3">Subscribers</dt>
                <dd className="num text-white">{fmtInt(profile.subscribers)}</dd>
              </>
            ) : null}
          </dl>
        ) : null}

        <a
          href={`${MB_URL}/user/${encodeURIComponent(name)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start rounded-sm py-2.5 text-[14px] text-ink-2 sm:py-0 transition-colors hover:text-data"
        >
          MusicBrainz profile
        </a>
      </div>
    </Panel>
  );
}

function Bio({ html }: { html: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [overflowing, setOverflowing] = React.useState(false);

  // Only measure while collapsed: an expanded bio is taller by design and must keep its toggle.
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const measure = () => setOverflowing(el.scrollHeight > el.clientHeight + 1);
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [html, open]);

  const showToggle = overflowing || open;

  return (
    <div>
      <div
        ref={ref}
        className={cx(
          "break-words text-[14px] leading-6 text-ink-2 [&_a]:text-white [&_a]:underline [&_a]:decoration-[#555] [&_a]:underline-offset-2 [&_a:hover]:text-data [&_p]:m-0 [&_p+p]:mt-3"
        )}
        style={
          open
            ? undefined
            : { display: "-webkit-box", WebkitLineClamp: BIO_CLAMP_LINES, WebkitBoxOrient: "vertical", overflow: "hidden" }
        }
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {showToggle ? (
        <div className="mt-2">
          <Button size="sm" variant="tertiary" onPress={() => setOpen((o) => !o)}>
            {open ? "Show less" : "Read more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
