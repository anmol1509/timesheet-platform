/**
 * Re-mounts on every navigation between pages, so each page eases in instead of snapping.
 * Stays put on router.refresh() and on search-param changes (filters, tabs), so those don't flash.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
