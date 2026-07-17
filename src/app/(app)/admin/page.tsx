import { requireAdmin } from "@/lib/session";
import { getSettings, getTeamMembers, getTiers, getTypes } from "@/lib/data";
import {
  GeneralSettingsForm,
  TeamRoster,
  TierEditor,
  TypeEditor,
  VisibilityChainForm,
} from "@/components/admin-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdmin();
  const [settings, members, tiers, types] = await Promise.all([
    getSettings(),
    getTeamMembers(true),
    getTiers(true),
    getTypes(true),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Administration</h1>
        <p className="mt-1 text-sm text-slate-500">
          Framework configuration, team roster, and the Care 3 escalation
          visibility chain. Admin-only.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Framework & lifecycle
        </h2>
        <GeneralSettingsForm settings={settings} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-slate-900">
          Care 3 escalation-visibility chain
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          Who is looped in when a CSM explicitly elevates a Care 3 escalation.
          Elevation is always a manual action by the CSM — this only controls
          how far up the chain the notification travels.
        </p>
        <VisibilityChainForm settings={settings} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-slate-900">Team roster</h2>
        <p className="mb-4 text-sm text-slate-500">
          Access is granted by adding a member here with their WWT (Okta)
          email. Administrators can edit and close every escalation.
        </p>
        <TeamRoster members={members} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-slate-900">Care tiers</h2>
        <p className="mb-4 text-sm text-slate-500">
          The 3-Tier Care Model, stored as a configurable enum — extend or
          re-label without a schema change.
        </p>
        <TierEditor tiers={tiers} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-slate-900">
          Escalation types
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          Only shown across the app when “tiers + types” is enabled above.
        </p>
        <TypeEditor types={types} />
      </section>
    </div>
  );
}
