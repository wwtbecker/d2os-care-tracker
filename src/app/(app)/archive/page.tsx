import { requireMember } from "@/lib/session";
import { getEscalations, getSettings } from "@/lib/data";
import { EscalationTable } from "@/components/escalation-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Archive" };

export default async function ArchivePage(props: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireMember();
  const sp = await props.searchParams;
  const [settings, escalations] = await Promise.all([
    getSettings(),
    getEscalations({ status: "archived", q: sp.q || undefined }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Archive</h1>
        <p className="mt-1 text-sm text-slate-500">
          Resolved escalations are archived automatically after{" "}
          {settings.auto_archive_days} days. Nothing is deleted — the full
          history stays searchable here.
        </p>
      </div>

      <form method="GET" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search archived escalations…"
          className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800"
        >
          Search
        </button>
      </form>

      <EscalationTable
        escalations={escalations}
        showTypes={settings.types_enabled}
        emptyMessage="No archived escalations yet."
      />
    </div>
  );
}
