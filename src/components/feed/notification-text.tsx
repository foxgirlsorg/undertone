"use client";

import * as React from "react";
import DOMPurify from "dompurify";

/**
 * Renders a ListenBrainz notification message (HTML). Only http(s) links and line breaks survive;
 * every other tag is removed and its text kept. The HTML is sanitized by DOMPurify before it is
 * injected. Without a DOM (server render) only the text is shown, as React text, never raw HTML.
 */
export function NotificationText({ html }: { html: string }) {
  const clean = React.useMemo(
    () => (typeof window === "undefined" ? null : sanitizeNotification(html)),
    [html]
  );
  if (clean === null) return <>{html.replace(/<[^>]*>/g, "")}</>;
  return (
    <span
      className="[&_a]:text-white [&_a]:underline-offset-2 [&_a:hover]:text-data [&_a:hover]:underline"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

let hooked = false;

function sanitizeNotification(html: string): string {
  if (!hooked) {
    hooked = true;
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      if (node.tagName === "A") {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer nofollow");
      }
    });
  }
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["a", "br"],
    ALLOWED_ATTR: ["href"],
    ALLOWED_URI_REGEXP: /^https?:\/\//i,
  });
}
