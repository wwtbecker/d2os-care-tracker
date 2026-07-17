import { requireMember } from "@/lib/session";
import { getAccounts } from "@/lib/data";
import { AccountForm, AccountList } from "@/components/account-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Accounts" };

export default async function AccountsPage() {
  await requireMember();
  const accounts = await getAccounts();

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

      <AccountList accounts={accounts} />
    </div>
  );
}
