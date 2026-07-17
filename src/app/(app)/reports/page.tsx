import { requireMember } from "@/lib/session";
import {
  getEscalations,
  getLatestExecSummary,
  getSettings,
  getTiers,
} from "@/lib/data";
import {
  buildResolutionStats,
  buildSnapshot,
  buildVolumeTrend,
} from "@/lib/reporting";
import {
  CountBarChart,
  ResolutionChart,
  VolumeTrendChart,
} from "@/components/report-charts";
import { ExecSummaryPanel } from "@/components/exec-summary-panel";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports & Insights" };

export default async function ReportsPage() {
  await requireMember();
  const [settings, tiers, active, all, latestExec] = await Promise.all([
    getSettings(),
    getTiers(),
    getEscalations({ status: "active" }),
    getEscalations({ status: "all" }),
    getLatestExecSummary(),
  ]);

  const snapshot = buildSnapshot(active, tiers);
  const trend = buildVolumeTrend(all, tiers);
  const resolution = buildResolutionStats(all, tiers);
  const care3Count = active.filter(
    (e) => e.tier_key === "care_3" || e.executive_reporting
  ).length;

  const exportLink =
    "inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50";

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Reports &amp; Insights
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Weekly snapshot as of {formatDate(snapshot.generatedAt)} ·{" "}
            {snapshot.totalActive} active escalations · {care3Count} in the
            executive pipeline
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/export/csv?scope=active" className={exportLink}>
            ⬇ CSV — active
          </a>
          <a href="/api/export/csv?scope=all" className={exportLink}>
            ⬇ CSV — full history
          </a>
          <a href="/api/export/pptx" className={exportLink}>
            ⬇ PowerPoint — leadership deck
          </a>
        </div>
      </div>

      {/* Weekly snapshot */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">
            Open by tier
          </h2>
          <ul className="mt-4 space-y-3">
            {snapshot.byTier.map((row) => (
              <li key={row.label} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-slate-600">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: row.color }}
                  />
                  {row.label}
                </span>
                <span className="text-xl font-semibold text-slate-900">
                  {row.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">Open by CSM</h2>
          <div className="mt-2">
            <CountBarChart data={snapshot.byCsm} />
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">
            Open by account
          </h2>
          <div className="mt-2">
            <CountBarChart data={snapshot.byAccount} />
          </div>
        </div>
      </section>

      {/* Trends */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">
            Escalation volume — opened per week (last 12 weeks)
          </h2>
          <div className="mt-3">
            <VolumeTrendChart
              data={trend}
              tiers={tiers.map((t) => ({ label: t.label, color: t.color }))}
            />
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">
            Average time to resolution by tier
          </h2>
          <div className="mt-3">
            <ResolutionChart data={resolution} />
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Opened → resolved, across the full history (
            {resolution.reduce((s, r) => s + r.resolvedCount, 0)} resolved
            escalations).
          </p>
        </div>
      </section>

      {/* Executive summary */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Weekly Care 3 executive summary
        </h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">
          AI-generated brief for Elena&apos;s leadership syncs
          {settings.care3_visibility_chain.enabled
            ? " (visibility chain is enabled)"
            : ""}
          . Paste into email/Teams or export the PowerPoint deck above.
        </p>
        <ExecSummaryPanel
          latest={
            latestExec
              ? { content: latestExec.content, created_at: latestExec.created_at }
              : null
          }
        />
      </section>
    </div>
  );
}
