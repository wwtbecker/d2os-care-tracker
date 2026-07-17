import Link from "next/link";
import { requireMember } from "@/lib/session";
import {
  getEscalations,
  getSettings,
  getTeamMembers,
  getTiers,
  getTypes,
} from "@/lib/data";
import { EscalationTable } from "@/components/escalation-table";
import type { EscalationFilters, EscalationStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Escalations" };

const STATUS_OPTIONS = [
  { value: "", label: "All (excl. archived)" },
  { value: "active", label: "Active (open + in progress)" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
];

export default async function EscalationsPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireMember();
  const sp = await props.searchParams;

  const filters: EscalationFilters = {
    status: (sp.status as EscalationStatus | "active") || undefined,
    tier: sp.tier || undefined,
    type: sp.type || undefined,
    owner: sp.owner || undefined,
    q: sp.q || undefined,
    executive: sp.executive === "1" || undefined,
  };

  const [settings, tiers, types, members, escalations] = await Promise.all([
    getSettings(),
    getTiers(),
    getTypes(),
    getTeamMembers(),
    getEscalations(filters),
  ]);

  const selectClass =
    "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Escalations</h1>
          <p className="mt-1 text-sm text-slate-500">
            All escalations are visible to the whole team; edits are limited to
            the owner and administrators.
          </p>
        </div>
        <Link
          href="/escalations/new"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + Log escalation
        </Link>
      </div>

      <form
        method="GET"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
      >
        <input
          type="search"
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search title, description, account…"
          className="min-w-56 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
        <select name="status" defaultValue={sp.status ?? ""} className={selectClass}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select name="tier" defaultValue={sp.tier ?? ""} className={selectClass}>
          <option value="">All tiers</option>
          {tiers.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
        {settings.types_enabled && (
          <select name="type" defaultValue={sp.type ?? ""} className={selectClass}>
            <option value="">All types</option>
            {types.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        )}
        <select name="owner" defaultValue={sp.owner ?? ""} className={selectClass}>
          <option value="">All CSMs</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input
            type="checkbox"
            name="executive"
            value="1"
            defaultChecked={sp.executive === "1"}
            className="h-4 w-4 rounded border-slate-300"
          />
          Exec reporting
        </label>
        <button
          type="submit"
          className="rounded-lg bg-ink-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-ink-800"
        >
          Filter
        </button>
        <Link href="/escalations" className="text-sm text-slate-400 hover:underline">
          Reset
        </Link>
      </form>

      <p className="text-xs text-slate-400">
        {escalations.length} result{escalations.length === 1 ? "" : "s"}
      </p>

      <EscalationTable escalations={escalations} showTypes={settings.types_enabled} />
    </div>
  );
}
