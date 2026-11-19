"use client";

import * as React from "react";
import { Button, Disclosure } from "@heroui/react";

const RULES: Array<{ syntax: string; does: string; example: string }> = [
  {
    syntax: "artist:(name)",
    does: "Music by one artist, matched on the artist's name.",
    example: "artist:(radiohead)",
  },
  {
    syntax: "tag:(tag)",
    does: "Recordings carrying a MusicBrainz tag. Put spaces inside the brackets.",
    example: "tag:(trip hop)",
  },
  {
    syntax: "#tag",
    does: "Short form of tag:() for a single word.",
    example: "#metal",
  },
  {
    syntax: "stats:username",
    does: "Music from a user's own top recordings, so you hear what they listen to.",
    example: "stats:rob",
  },
  {
    syntax: "recs:username",
    does: "Music based on the recommendations a user has been given.",
    example: "recs:rob",
  },
  {
    syntax: "playlist:(mbid)",
    does: "Tracks from an existing ListenBrainz playlist, given by its MBID.",
    example: "playlist:(00000000-0000-0000-0000-000000000000)",
  },
];

/** Collapsible help for the prompt grammar. Mode choices are described too. */
export function PromptSyntax() {
  return (
    <Disclosure defaultExpanded={false}>
      <Disclosure.Heading>
        <Button slot="trigger" variant="tertiary" size="sm">
          Prompt syntax
          <Disclosure.Indicator />
        </Button>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body>
          <div className="mt-3 flex flex-col gap-4 text-[14px] text-ink-2">
            <p>
              Each part adds music to the mix. Wrap multi-word names in brackets so the whole name is read as one
              value.
            </p>
            <dl className="grid gap-3 sm:grid-cols-[minmax(0,auto)_minmax(0,1fr)] sm:gap-x-6">
              {RULES.map((r) => (
                <div key={r.syntax} className="contents">
                  <dt className="font-mono text-[13px] text-white">{r.syntax}</dt>
                  <dd>
                    {r.does} <span className="text-ink-3">e.g.</span>{" "}
                    <code className="font-mono text-[13px] text-white">{r.example}</code>
                  </dd>
                </div>
              ))}
            </dl>
            <p>
              <span className="text-white">Modes</span> set how adventurous the mix is. Easy stays close to the
              prompt, medium widens the net, hard reaches further from it and takes more risks.
            </p>
            <p className="text-ink-3">
              The full grammar is documented in the Troi project&apos;s LB Radio guide.
            </p>
          </div>
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}
