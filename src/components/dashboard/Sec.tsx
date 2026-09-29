/** A section of a module dashboard that its viewer can switch off from Customize. */
export function Sec({ id, hidden, children }: { id: string; hidden: Set<string>; children: React.ReactNode }) {
  return hidden.has(id) ? null : <>{children}</>;
}
