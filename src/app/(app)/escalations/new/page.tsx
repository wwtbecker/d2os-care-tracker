import { requireMember } from "@/lib/session";
import {
  getAccounts,
  getSettings,
  getTeamMembers,
  getTiers,
  getTypes,
} from "@/lib/data";
import { EscalationForm } from "@/components/escalation-form";
import { aiEnabled } from "@/lib/anthropic";

export const dynamic = "force-dynamic";
export const metadata = { title: "Log escalation" };

export default async function NewEscalationPage() {
  const member = await requireMember();
  const [settings, tiers, types, members, accounts] = await Promise.all([
    getSettings(),
    getTiers(),
    getTypes(),
    getTeamMembers(),
    getAccounts(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Log escalation</h1>
        <p className="mt-1 text-sm text-slate-500">
          Capture the customer escalation and place it in the 3-Tier Care
          Model. Not sure which tier? Write the description first and use the
          AI suggestion.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <EscalationForm
          mode="create"
          tiers={tiers}
          types={types}
          members={members}
          accounts={accounts}
          settings={settings}
          currentMemberId={member.id}
          aiAvailable={aiEnabled()}
        />
      </div>
    </div>
  );
}
