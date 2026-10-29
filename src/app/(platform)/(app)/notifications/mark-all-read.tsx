"use client";

import { useTransition } from "react";
import { markAllNotificationsReadAction } from "./actions";

import { Button } from "@/components/ui/Button";
export function MarkAllRead() {
  const [pending, start] = useTransition();
  return (
    <Button variant="secondary" size="btn" type="button" disabled={pending} onClick={() => start(() => markAllNotificationsReadAction())} loading={pending}>
      Mark all read
    </Button>
  );
}
