import { redirect } from "next/navigation";
import { getVendor } from "@/lib/vendor/session";
import { VendorNav } from "./vendor-nav";
import { vendorSignOutAction } from "./actions";

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const vendor = await getVendor();
  if (!vendor) redirect("/vendor/login");
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-20 border-b border-default bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-primary">{vendor.name}</p>
            <p className="truncate text-[11px] text-subtle">Supplier portal · Burj Al Aweer</p>
          </div>
          <form action={vendorSignOutAction}>
            <button type="submit" className="btn btn-secondary">Sign out</button>
          </form>
        </div>
        <VendorNav />
      </header>
      <main className="mx-auto max-w-4xl space-y-5 px-4 py-5">{children}</main>
    </div>
  );
}
