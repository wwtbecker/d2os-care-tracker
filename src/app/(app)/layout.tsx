import Link from "next/link";
import { requireMember } from "@/lib/session";
import { getUnreadCount } from "@/lib/data";
import { signOut } from "@/auth";
import { NavLinks } from "@/components/nav-links";
import { devBypassEnabled } from "@/lib/dev-bypass";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const member = await requireMember();
  let unread = 0;
  try {
    unread = await getUnreadCount(member.id);
  } catch {
    // Notification count is non-critical chrome; never block the page on it.
  }

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col bg-ink-950 text-slate-300">
        <Link href="/" className="flex items-center gap-3 px-5 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            D2
          </span>
          <span className="text-sm font-semibold leading-tight text-white">
            D2OS Care Tracker
            <span className="block text-[11px] font-normal text-slate-400">
              WWT Day 2 Operations
            </span>
          </span>
        </Link>

        <NavLinks isAdmin={member.role === "admin"} unread={unread} />

        <div className="mt-auto border-t border-white/10 px-5 py-4">
          <p className="truncate text-sm font-medium text-white">{member.name}</p>
          <p className="truncate text-xs text-slate-400">
            {member.role === "admin" ? "Administrator" : "CSM"} · {member.email}
          </p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="mt-3 w-full rounded-md border border-white/15 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="ml-60 min-h-screen flex-1 px-8 py-8">
        {devBypassEnabled() && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-800">
            DEV AUTH BYPASS ACTIVE — Okta sign-in is being skipped. Local
            testing only; remove DEV_BYPASS_AUTH from .env.local when done.
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
