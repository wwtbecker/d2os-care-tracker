import Link from "next/link";
import { StatusBadge, TierBadge, TypeBadge } from "@/components/badges";
import { formatDate, isOverdue } from "@/lib/format";
import type { EscalationRow } from "@/lib/types";

export function EscalationTable({
  escalations,
  showTypes,
  emptyMessage = "No escalations match.",
}: {
  escalations: EscalationRow[];
  showTypes: boolean;
  emptyMessage?: string;
}) {
  if (escalations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="table-scroll overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
            <th className="px-4 py-3 font-semibold">Account / Title</th>
            <th className="px-4 py-3 font-semibold">Tier</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Owner</th>
            <th className="px-4 py-3 font-semibold">Opened</th>
            <th className="px-4 py-3 font-semibold">Target</th>
            <th className="px-4 py-3 font-semibold">Next cadence</th>
          </tr>
        </thead>
        <tbody>
          {escalations.map((e) => (
            <tr
              key={e.id}
              className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
            >
              <td className="px-4 py-3">
                <Link href={`/escalations/${e.id}`} className="group block">
                  <span className="font-medium text-slate-900 group-hover:underline">
                    {e.account_name}
                  </span>
                  <span className="block max-w-md truncate text-xs text-slate-500">
                    {e.title}
                  </span>
                </Link>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col items-start gap-1">
                  <TierBadge tier={e.tier} />
                  {showTypes && <TypeBadge type={e.type} />}
                  {e.executive_reporting && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                      Exec reporting
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={e.status} />
              </td>
              <td className="px-4 py-3 text-slate-600">{e.owner?.name ?? "—"}</td>
              <td className="px-4 py-3 text-slate-600">{formatDate(e.opened_at)}</td>
              <td className="px-4 py-3 text-slate-600">
                {formatDate(e.target_resolution_date)}
              </td>
              <td className="px-4 py-3">
                {e.tier_key === "care_2" && e.next_cadence_date ? (
                  <span
                    className={
                      isOverdue(e.next_cadence_date) &&
                      (e.status === "open" || e.status === "in_progress")
                        ? "font-semibold text-brand-700"
                        : "text-slate-600"
                    }
                  >
                    {formatDate(e.next_cadence_date)}
                  </span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
