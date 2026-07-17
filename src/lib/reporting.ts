import { daysBetween } from "./format";
import type { EscalationRow, EscalationTier } from "./types";

export interface SnapshotCount {
  label: string;
  count: number;
  color?: string;
}

export interface WeeklySnapshot {
  generatedAt: string;
  totalActive: number;
  byTier: SnapshotCount[];
  byCsm: SnapshotCount[];
  byAccount: SnapshotCount[];
}

/** Weekly snapshot: open escalations by tier, CSM, and account. */
export function buildSnapshot(
  active: EscalationRow[],
  tiers: EscalationTier[]
): WeeklySnapshot {
  const countBy = (key: (e: EscalationRow) => string): Map<string, number> => {
    const map = new Map<string, number>();
    for (const e of active) {
      const k = key(e);
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  };

  const tierCounts = countBy((e) => e.tier_key);
  const csmCounts = countBy((e) => e.owner?.name ?? "Unassigned");
  const accountCounts = countBy((e) => e.account_name);

  return {
    generatedAt: new Date().toISOString(),
    totalActive: active.length,
    byTier: tiers.map((t) => ({
      label: t.label,
      count: tierCounts.get(t.key) ?? 0,
      color: t.color,
    })),
    byCsm: [...csmCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    byAccount: [...accountCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export interface TrendWeek {
  week: string; // ISO date of Monday
  label: string;
  [tierLabel: string]: string | number;
}

/** Escalation volume over time: opened per ISO week, stacked by tier. */
export function buildVolumeTrend(
  all: EscalationRow[],
  tiers: EscalationTier[],
  weeks = 12
): TrendWeek[] {
  const mondayOf = (d: Date): string => {
    const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = copy.getUTCDay();
    copy.setUTCDate(copy.getUTCDate() - ((day + 6) % 7));
    return copy.toISOString().slice(0, 10);
  };

  const buckets: TrendWeek[] = [];
  const now = new Date();
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i * 7);
    const week = mondayOf(d);
    const label = new Date(`${week}T00:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    const bucket: TrendWeek = { week, label };
    for (const t of tiers) bucket[t.label] = 0;
    buckets.push(bucket);
  }

  const index = new Map(buckets.map((b) => [b.week, b]));
  for (const e of all) {
    const week = mondayOf(new Date(`${e.opened_at}T00:00:00Z`));
    const bucket = index.get(week);
    if (!bucket) continue;
    const label = e.tier?.label ?? e.tier_key;
    bucket[label] = ((bucket[label] as number) ?? 0) + 1;
  }
  return buckets;
}

export interface ResolutionStat {
  label: string;
  color: string;
  avgDays: number | null;
  resolvedCount: number;
}

/** Average time-to-resolution (opened → resolved) by tier. */
export function buildResolutionStats(
  all: EscalationRow[],
  tiers: EscalationTier[]
): ResolutionStat[] {
  return tiers.map((t) => {
    const resolved = all.filter(
      (e) => e.tier_key === t.key && e.resolved_at !== null
    );
    const total = resolved.reduce(
      (sum, e) => sum + Math.max(0, daysBetween(e.opened_at, e.resolved_at!)),
      0
    );
    return {
      label: t.label,
      color: t.color,
      avgDays: resolved.length ? Math.round((total / resolved.length) * 10) / 10 : null,
      resolvedCount: resolved.length,
    };
  });
}
