"use client";

import * as React from "react";
import { Button, Modal, toast } from "@heroui/react";
import { ModalShell, errorText, type ListenModalProps } from "./shared";

export function DetailsModal({ open, listen, onClose }: ListenModalProps) {
  return (
    <ModalShell open={open} onClose={onClose} title="Inspect listen" wide>
      <DetailsBody listen={listen} onClose={onClose} />
    </ModalShell>
  );
}

function DetailsBody({ listen, onClose }: Pick<ListenModalProps, "listen" | "onClose">) {
  const json = React.useMemo(() => JSON.stringify(listen, null, 2), [listen]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      toast.success("Listen JSON copied");
    } catch (err) {
      toast.danger("Couldn't copy the JSON", { description: errorText(err) });
    }
  };

  return (
    <>
      <Modal.Body>
        <pre className="max-h-[60vh] overflow-auto rounded-[12px] bg-raised p-3 font-mono text-[12px] leading-5 text-ink-2">
          <code>{json}</code>
        </pre>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="tertiary" onPress={onClose}>
          Close
        </Button>
        <Button onPress={copy}>Copy JSON</Button>
      </Modal.Footer>
    </>
  );
}
