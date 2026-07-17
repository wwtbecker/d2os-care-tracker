import Link from "next/link";
import { requireMember } from "@/lib/session";
import {
  getEscalations,
  getSettings,
  getTiers,
  runMaintenance,
} from "@/lib/data";
import { EscalationTable } from "@/components/escalation-table";
import { TierBadge } from "@/components/badges";
import { isOverdue, todayISO } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const member = await requireMember();

  // Opportunistic maintenance (auto-archive + cadence reminders) so the
  // system self-heals even without the scheduled cron.
  try {
    await runMaintenance();
  } catch {
    // Never block the dashboard on maintenance.
  }

  const [settings, tiers, active] = await Promise.all([
    getSettings(),
    getTiers(),
    getEscalations({ status: "active" }),
  ]);

  const mine = active.filter((e) => e.owner_id === member.id);
  const cadenceDue = active.filter(
    (e) => e.tier_key === "care_2" && isOverdue(e.next_cadence_date)
  );
  const care3 = active.filter((e) => e.tier_key === "care_3");
  const overdueTargets = active.filter(
    (e) =>
      e.target_resolution_date && e.target_resolution_date < todayISO()
  );

  const byTier = tiers.map((tier) => ({
    tier,
    count: active.filter((e) => e.tier_key === tier.key).length,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            {active.length} active escalation{active.length === 1 ? "" : "s"} across
            the team · {mine.length} assigned to you
          </p>
        </div>
        <Link
          href="/escalations/new"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + Log escalation
        </Link>
      </div>

      {/* Tier summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {byTier.map(({ tier, count }) => (
          <Link
            key={tier.key}
            href={`/escalations?tier=${tier.key}&status=active`}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <TierBadge tier={tier} />
              <span className="text-3xl font-semibold text-slate-900">{count}</span>
            </div>
            <p className="mt-3 line-clamp-2 text-xs text-slate-500">
              {tier.description}
            </p>
          </Link>
        ))}
      </div>

      {/* Attention strip */}
      {(cadenceDue.length > 0 || overdueTargets.length > 0) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {cadenceDue.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                {cadenceDue.length} Care 2 touchpoint
                {cadenceDue.length === 1 ? "" : "s"} due
              </p>
              <ul className="mt-2 space-y-1">
                {cadenceDue.slice(0, 5).map((e) => (
                  <li key={e.id} className="text-sm">
                    <Link
                      href={`/escalations/${e.id}`}
                      className="text-amber-800 underline-offset-2 hover:underline"
                    >
                      {e.account_name} — {e.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {overdueTargets.length > 0 && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-900">
                {overdueTargets.length} past target resolution date
              </p>
              <ul className="mt-2 space-y-1">
                {overdueTargets.slice(0, 5).map((e) => (
                  <li key={e.id} className="text-sm">
                    <Link
                      href={`/escalations/${e.id}`}
                      className="text-red-800 underline-offset-2 hover:underline"
                    >
                      {e.account_name} — {e.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Care 3 spotlight */}
      {care3.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              Care 3 — executive visibility
            </h2>
            <Link
              href="/reports"
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              Leadership exports →
            </Link>
          </div>
          <EscalationTable escalations={care3} showTypes={settings.types_enabled} />
        </section>
      )}

      {/* My escalations */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">My escalations</h2>
          <Link
            href="/escalations"
            className="text-sm font-medium text-slate-500 hover:underline"
          >
            View all →
          </Link>
        </div>
        <EscalationTable
          escalations={mine}
          showTypes={settings.types_enabled}
          emptyMessage="Nothing assigned to you right now."
        />
      </section>
    </div>
  );
}
