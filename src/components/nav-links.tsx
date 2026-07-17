"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: { href: string; label: string; adminOnly?: boolean }[] = [
  { href: "/", label: "Dashboard" },
  { href: "/escalations", label: "Escalations" },
  { href: "/accounts", label: "Accounts" },
  { href: "/reports", label: "Reports & Insights" },
  { href: "/archive", label: "Archive" },
  { href: "/notifications", label: "Notifications" },
  { href: "/admin", label: "Admin", adminOnly: true },
];

export function NavLinks({
  isAdmin,
  unread,
}: {
  isAdmin: boolean;
  unread: number;
}) {
  const pathname = usePathname();

  return (
    <nav className="mt-2 flex flex-col gap-0.5 px-3">
      {LINKS.filter((l) => !l.adminOnly || isAdmin).map((link) => {
        const active =
          link.href === "/"
            ? pathname === "/"
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
              active
                ? "bg-white/10 font-medium text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            }`}
          >
            <span>{link.label}</span>
            {link.href === "/notifications" && unread > 0 && (
              <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                {unread}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
