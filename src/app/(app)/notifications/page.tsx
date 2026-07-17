import Link from "next/link";
import { requireMember } from "@/lib/session";
import { getNotifications } from "@/lib/data";
import { markAllNotificationsRead, markNotificationRead } from "@/app/actions";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications" };

const KIND_LABELS: Record<string, string> = {
  cadence_due: "Cadence",
  elevation: "Care 3",
  assignment: "Assignment",
  status_change: "Status",
  system: "System",
};

export default async function NotificationsPage() {
  const member = await requireMember();
  const notifications = await getNotifications(member.id);
  const unread = notifications.filter((n) => !n.read_at);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">
            Cadence reminders, assignments, and Care 3 elevations.
          </p>
        </div>
        {unread.length > 0 && (
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Mark all read
            </button>
          </form>
        )}
      </div>

      <ul className="space-y-2">
        {notifications.map((n) => (
          <li
            key={n.id}
            className={`rounded-xl border p-4 shadow-sm ${
              n.read_at
                ? "border-slate-200 bg-white"
                : "border-brand-600/30 bg-brand-50"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {KIND_LABELS[n.kind] ?? n.kind} · {formatDateTime(n.created_at)}
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900">{n.title}</p>
                {n.body && <p className="mt-0.5 text-sm text-slate-600">{n.body}</p>}
                {n.escalation_id && (
                  <Link
                    href={`/escalations/${n.escalation_id}`}
                    className="mt-1 inline-block text-sm font-medium text-brand-700 hover:underline"
                  >
                    Open escalation →
                  </Link>
                )}
              </div>
              {!n.read_at && (
                <form action={markNotificationRead}>
                  <input type="hidden" name="id" value={n.id} />
                  <button
                    type="submit"
                    className="shrink-0 rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-white"
                  >
                    Mark read
                  </button>
                </form>
              )}
            </div>
          </li>
        ))}
        {notifications.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
            You&apos;re all caught up.
          </p>
        )}
      </ul>
    </div>
  );
}
