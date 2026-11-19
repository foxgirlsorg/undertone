"use client";

import { Empty, ErrorNote, Page, Panel, SkeletonRows } from "@/components/ui";
import { OutButton } from "@/components/settings/settings-kit";
import { apiGet } from "@/components/settings/api-fetch";
import { fmtDateLong } from "@/lib/format";
import { useLB } from "@/lib/use-lb";

type DumpInfo = { id: number; timestamp: string; dump_type: string };
type DumpKind = "full" | "incremental";

const MIRROR_URL = "https://data.metabrainz.org/pub/musicbrainz/listenbrainz/";
/** How far back from the newest dump to look for the newest dump of each kind. */
const PROBE_DEPTH = 12;

const kindOf = (type: string): DumpKind | null =>
  type.includes("incremental") ? "incremental" : type.includes("full") ? "full" : null;

/** "20190625-165900" (UTC) -> Date. */
function parseDumpTimestamp(ts: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(ts);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
}

type DumpSummary = { full: DumpInfo | null; incremental: DumpInfo | null };

export default function DataPage() {
  const dumps = useLB(["dump-info"], async (api): Promise<DumpSummary> => {
    const latest = await apiGet<DumpInfo>(`${api.APIBaseURI}/status/get-dump-info`);
    if (!latest) return { full: null, incremental: null };

    // The endpoint only returns the newest dump. Look a few IDs back for the newest of the other kind.
    const probes = await Promise.allSettled(
      Array.from({ length: PROBE_DEPTH }, (_, i) =>
        apiGet<DumpInfo>(`${api.APIBaseURI}/status/get-dump-info?id=${latest.id - 1 - i}`)
      )
    );
    const found: DumpInfo[] = [latest];
    for (const p of probes) {
      if (p.status === "fulfilled" && p.value) found.push(p.value);
    }
    const newest = (kind: DumpKind) =>
      found
        .filter((d) => kindOf(d.dump_type) === kind)
        .sort((a, b) => b.id - a.id)[0] ?? null;
    return { full: newest("full"), incremental: newest("incremental") };
  });

  return (
    <Page
      title="Data dumps"
      subtitle="ListenBrainz publishes its data as dumps, so you can analyse or mirror it yourself."
    >
      <Panel title="Latest dumps">
        {dumps.isLoading ? <SkeletonRows rows={2} cover={false} pitch={56} /> : null}
        {dumps.error ? <ErrorNote error={dumps.error} onRetry={() => dumps.mutate()} /> : null}
        {dumps.data ? (
          dumps.data.full || dumps.data.incremental ? (
            <ul className="flex flex-col divide-y divide-[#1f1f1f]">
              <DumpRow
                title="Full export"
                description="A complete copy of the data. Each one starts a new series of incremental dumps."
                dump={dumps.data.full}
              />
              <DumpRow
                title="Incremental"
                description="Daily updates made since the latest full export."
                dump={dumps.data.incremental}
              />
            </ul>
          ) : (
            <Empty>No dumps have been published yet.</Empty>
          )
        ) : null}
      </Panel>

      <Panel title="Download">
        <div className="flex flex-col gap-4 text-[14px] leading-6 text-ink-2">
          <p>
            The dumps are mirrored over HTTP. Open the directory, find the dump with the timestamp shown above, and
            download the files you need.
          </p>
          <div>
            <OutButton href={MIRROR_URL}>Browse the dump mirror</OutButton>
          </div>
        </div>
      </Panel>
    </Page>
  );
}

function DumpRow({ title, description, dump }: { title: string; description: string; dump: DumpInfo | null }) {
  const when = dump ? parseDumpTimestamp(dump.timestamp) : null;
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium">{title}</div>
        <p className="mt-1 text-[13px] text-ink-3">{description}</p>
      </div>
      <div className="text-right text-[14px]">
        {dump ? (
          <>
            <div className="num text-white">{when ? fmtDateLong(when) : dump.timestamp}</div>
            <div className="num text-[12px] text-ink-3">
              {when ? `${when.toISOString().slice(11, 16)} UTC · ` : ""}dump #{dump.id}
            </div>
          </>
        ) : (
          <span className="text-ink-3">Not found in the latest dumps</span>
        )}
      </div>
    </li>
  );
}
