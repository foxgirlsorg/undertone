"use client";

import * as React from "react";
import { Button, toast } from "@heroui/react";
import { useAuth } from "@/lib/auth";
import { useLB } from "@/lib/use-lb";
import { ErrorNote, Empty, Panel, SkeletonRows } from "@/components/ui";
import { ListenCard } from "@/components/listen/listen-card";
import { fetchCurrentPin, pinToListen, sameUser } from "@/components/user/data";

/** The user's current pin, with its blurb. The owner can unpin it. */
export function PinnedPanel({ name }: { name: string }) {
  const { api, user } = useAuth();
  const pin = useLB(["pin-current", name], (a) => fetchCurrentPin(a, name));
  const [unpinning, setUnpinning] = React.useState(false);
  const isMe = sameUser(user?.name, name);

  const unpin = async () => {
    if (!user) return;
    setUnpinning(true);
    try {
      const status = await api.unpinRecording(user.token);
      if (status !== 200) throw new Error(`ListenBrainz answered ${status}.`);
      toast.success("Unpinned");
      pin.mutate(null, { revalidate: false });
    } catch (e) {
      toast.danger("Couldn't unpin", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setUnpinning(false);
    }
  };

  const listen = React.useMemo(() => (pin.data ? pinToListen(pin.data) : undefined), [pin.data]);

  return (
    <Panel title="Pinned">
      {pin.isLoading ? (
        <SkeletonRows rows={1} pitch={64} />
      ) : pin.error ? (
        <ErrorNote error={pin.error} onRetry={() => pin.mutate()} />
      ) : !listen || !pin.data ? (
        <Empty>{isMe ? "Nothing pinned. Use a track's menu to pin one." : `${name} has nothing pinned.`}</Empty>
      ) : (
        <div>
          {/* canDelete={false}: this is a pin, not a listen; deleting it is not offered here. */}
          <ListenCard listen={listen} meta="Pinned" canDelete={false} compact />
          {pin.data.blurb_content ? (
            <p className="mt-2 px-2 text-[14px] leading-6 text-ink-2">&ldquo;{pin.data.blurb_content}&rdquo;</p>
          ) : null}
          {isMe ? (
            <div className="mt-3 flex justify-end">
              <Button size="sm" variant="secondary" isDisabled={unpinning} onPress={unpin}>
                Unpin
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </Panel>
  );
}
