"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Building2,
  ClipboardList,
  Wrench,
  Upload as UploadIcon,
  FileSpreadsheet,
  BedDouble,
  FileText,
  Clock,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/employees/new", label: "Add Employee", icon: UserPlus },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/projects", label: "Projects", icon: ClipboardList },
  { href: "/skills", label: "Skills", icon: Wrench },
  { href: "/upload", label: "Upload", icon: UploadIcon },
  { href: "/companies", label: "Generate Sheets", icon: FileSpreadsheet },
  { href: "/accommodation", label: "Accommodation", icon: BedDouble },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/history", label: "History", icon: Clock },
];

const ADMIN_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const links = isAdmin ? [...LINKS, ...ADMIN_LINKS] : LINKS;

  return (
    <nav className="flex flex-col gap-0.5">
      {links.map((link) => {
        const active =
          link.href === "/"
            ? pathname === "/"
            : pathname === link.href || pathname.startsWith(link.href + "/");
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-white/10 text-white"
                : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
