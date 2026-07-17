import type { EscalationStatus, EscalationTier, EscalationType } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";

export function TierBadge({ tier }: { tier: EscalationTier | null }) {
  if (!tier) return <span className="text-xs text-slate-400">—</span>;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
      style={{ backgroundColor: tier.color }}
      title={tier.description ?? undefined}
    >
      {tier.label}
    </span>
  );
}

const STATUS_STYLES: Record<EscalationStatus, string> = {
  open: "bg-sky-100 text-sky-800",
  in_progress: "bg-amber-100 text-amber-800",
  resolved: "bg-emerald-100 text-emerald-800",
  archived: "bg-slate-200 text-slate-600",
};

export function StatusBadge({ status }: { status: EscalationStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function TypeBadge({ type }: { type: EscalationType | null }) {
  if (!type) return null;
  return (
    <span className="inline-flex rounded-full border border-slate-300 px-2.5 py-0.5 text-xs font-medium text-slate-600">
      {type.label}
    </span>
  );
}

export function ExecBadge() {
  return (
    <span className="inline-flex rounded-full bg-ink-900 px-2.5 py-0.5 text-xs font-semibold text-white">
      Executive reporting
    </span>
  );
}
