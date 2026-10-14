import { redirect } from "next/navigation";
import { getVendor } from "@/lib/vendor/session";
import Link from "next/link";
import { Bell } from "lucide-react";
import { prisma } from "@/lib/db";
import { VendorNav } from "./vendor-nav";
import { vendorSignOutAction } from "./actions";

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const vendor = await getVendor();
  if (!vendor) redirect("/vendor/login");
  const unread = await prisma.supplierNotification.count({ where: { supplierId: vendor.id, readAt: null } });
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-20 border-b border-default bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-primary">{vendor.name}</p>
            <p className="truncate text-[11px] text-subtle">Supplier portal · Workforce ERP</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/vendor/notifications" className="relative rounded-md p-2 text-secondary transition hover:bg-surface-hover hover:text-primary" aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}>
              <Bell className="h-4.5 w-4.5" aria-hidden />
              {unread > 0 && <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--error)] px-1 text-[10px] font-semibold text-white">{unread > 9 ? "9+" : unread}</span>}
            </Link>
            <form action={vendorSignOutAction}>
              <button type="submit" className="btn btn-secondary">Sign out</button>
            </form>
          </div>
        </div>
        <VendorNav />
      </header>
      <main className="mx-auto max-w-4xl space-y-5 px-4 py-5">{children}</main>
    </div>
  );
}
