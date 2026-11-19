"use client";

import { useParams } from "next/navigation";
import { YearReport } from "@/components/yim/year-report";

/** One Year in Music report for a user, rendered inside the user layout. */
export default function YearInMusicYearPage() {
  const { username: rawUser, year: rawYear } = useParams<{ username: string; year: string }>();
  const username = decodeURIComponent(rawUser);
  const year = Number(rawYear);
  return <YearReport username={username} year={year} />;
}
