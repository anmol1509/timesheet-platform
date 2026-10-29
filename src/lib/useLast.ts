import { useState } from "react";

/** The latest value that was not empty. A panel that is closing keeps showing what it was showing instead of going blank. */
export function useLast<T>(value: T | null | undefined): T | null {
  const [last, setLast] = useState<T | null>(value ?? null);
  if (value != null && value !== last) setLast(value);
  return value ?? last;
}
