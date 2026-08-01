import { useMemo, useState } from "react";

export function useRowSelection(ids: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === ids.length ? new Set() : new Set(ids)));
  }

  function clear() {
    setSelected(new Set());
  }

  const allSelected = useMemo(
    () => ids.length > 0 && selected.size === ids.length,
    [ids.length, selected.size]
  );

  return { selected, toggle, toggleAll, clear, allSelected };
}
