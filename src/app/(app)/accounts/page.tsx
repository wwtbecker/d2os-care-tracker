import { requireMember } from "@/lib/session";
import { getAccounts, getOpenEscalationCounts } from "@/lib/data";
import { AccountForm, AccountList, ArchivedAccountList } from "@/components/account-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Accounts" };

export default async function AccountsPage(props: {
  searchParams: Promise<{ q?: string }>;
}) {
  const member = await requireMember();
  const sp = await props.searchParams;
  const [accounts, openCounts] = await Promise.all([
    getAccounts(true),
    getOpenEscalationCounts(),
  ]);

  const q = (sp.q ?? "").trim().toLowerCase();
  const matches = q
    ? accounts.filter((a) => a.name.toLowerCase().includes(q))
    : accounts;
  const active = matches.filter((a) => !a.archived_at);
  const archived = matches.filter((a) => a.archived_at);
  const isAdmin = member.role === "admin";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Customer accounts</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manual Gainsight lookup for now. Each account carries an optional
          Gainsight company ID, so when the live connector is available these
          records reconcile in place — no re-keying, no data migration.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Add account
        </h2>
        <AccountForm />
      </section>

      <form method="GET" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search accounts (active and archived)…"
          className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800"
        >
          Search
        </button>
      </form>

      <AccountList accounts={active} isAdmin={isAdmin} openCounts={openCounts} />

      <ArchivedAccountList accounts={archived} isAdmin={isAdmin} />
    </div>
  );
}
