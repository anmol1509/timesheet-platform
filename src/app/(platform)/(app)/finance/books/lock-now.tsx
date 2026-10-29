"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { lockBooksAction } from "./actions";

/** Locks a finished period from the to-do list, so nothing on or before the date can change. */
export function LockNow({ date }: { date: string }) {
  const [pending, start] = useTransition();
  return <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => { const r = await lockBooksAction(date); if (r.error) alert(r.error); })} loading={pending}>Lock</Button>;
}
