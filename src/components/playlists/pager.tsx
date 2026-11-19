"use client";

import * as React from "react";
import { Button } from "@heroui/react";
import { fmtInt } from "@/lib/format";

/** "Newer / Older" paging with an honest range: "26–50 of 84". Page is zero-based. */
export function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  if (total <= pageSize) return null;
  const first = page * pageSize + 1;
  const last = Math.min(total, (page + 1) * pageSize);
  const pages = Math.ceil(total / pageSize);
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-3 text-[13px] text-ink-3">
      <span className="num">
        {fmtInt(first)}–{fmtInt(last)} of {fmtInt(total)}
      </span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" isDisabled={page <= 0} onPress={() => onPage(page - 1)}>
          Newer
        </Button>
        <span className="num min-w-[4.5rem] text-center">
          {page + 1} / {pages}
        </span>
        <Button size="sm" variant="secondary" isDisabled={page >= pages - 1} onPress={() => onPage(page + 1)}>
          Older
        </Button>
      </div>
    </nav>
  );
}
