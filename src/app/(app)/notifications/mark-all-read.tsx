"use client";

import { useTransition } from "react";
import { markAllNotificationsReadAction } from "./actions";

export function MarkAllRead() {
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => start(() => markAllNotificationsReadAction())}>
      {pending ? "Marking…" : "Mark all read"}
    </button>
  );
}
