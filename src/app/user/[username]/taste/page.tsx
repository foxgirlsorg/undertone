"use client";

import { useParams } from "next/navigation";
import { TasteFeedback } from "@/components/taste/taste-feedback";
import { TastePins } from "@/components/taste/taste-pins";

export default function UserTastePage() {
  const params = useParams<{ username: string }>();
  const name = decodeURIComponent(params.username);

  return (
    <div className="grid items-start gap-[14px] lg:grid-cols-[7fr_5fr]">
      <TasteFeedback name={name} />
      <TastePins name={name} />
    </div>
  );
}
