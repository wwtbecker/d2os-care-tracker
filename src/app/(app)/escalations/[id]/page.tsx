import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/session";
import {
  getAccounts,
  getAiOutputs,
  getAuditForEscalation,
  getComments,
  getEscalation,
  getSettings,
  getTeamMembers,
  getTiers,
  getTouchpoints,
  getTypes,
} from "@/lib/data";
import { canEditEscalation } from "@/lib/permissions";
import { ExecBadge, StatusBadge, TierBadge, TypeBadge } from "@/components/badges";
import {
  CommentForm,
  ElevateButton,
  StatusControls,
  TouchpointForm,
} from "@/components/detail-panels";
import { AiSummaryPanel } from "@/components/ai-panel";
import { EscalationForm } from "@/components/escalation-form";
import { formatDate, formatDateTime, isOverdue } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EscalationDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const member = await requireMember();

  const escalation = await getEscalation(id);
  if (!escalation) notFound();

  const [settings, tiers, types, members, accounts, comments, touchpoints, aiOutputs, audit] =
    await Promise.all([
      getSettings(),
      getTiers(),
      getTypes(),
      getTeamMembers(),
      getAccounts(),
      getComments(id),
      getTouchpoints(id),
      getAiOutputs(id),
      getAuditForEscalation(id),
    ]);

  const canEdit = canEditEscalation(member, escalation);
  const isCare2 = escalation.tier_key === "care_2";
  const isCare3 = escalation.tier_key === "care_3";
  const latestSummary =
    aiOutputs.find((o) => o.kind === "spina_summary") ?? null;
  const elevatedBy = members.find((m) => m.id === escalation.elevated_by);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/escalations" className="text-sm text-slate-400 hover:underline">
        ← All escalations
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <TierBadge tier={escalation.tier} />
              {settings.types_enabled && <TypeBadge type={escalation.type} />}
              <StatusBadge status={escalation.status} />
              {escalation.executive_reporting && <ExecBadge />}
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-slate-900">
              {escalation.account_name}
            </h1>
            <p className="mt-1 text-base text-slate-600">{escalation.title}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Owner</dt>
              <dd className="font-medium text-slate-800">
                {escalation.owner?.name ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Opened</dt>
              <dd className="font-medium text-slate-800">
                {formatDate(escalation.opened_at)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Target</dt>
              <dd className="font-medium text-slate-800">
                {formatDate(escalation.target_resolution_date)}
              </dd>
            </div>
            {escalation.resolved_at && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">
                  Resolved
                </dt>
                <dd className="font-medium text-emerald-700">
                  {formatDate(escalation.resolved_at)}
                </dd>
              </div>
            )}
            {isCare2 && escalation.next_cadence_date && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">
                  Next cadence
                </dt>
                <dd
                  className={`font-medium ${
                    isOverdue(escalation.next_cadence_date) &&
                    escalation.status !== "resolved" &&
                    escalation.status !== "archived"
                      ? "text-brand-700"
                      : "text-slate-800"
                  }`}
                >
                  {formatDate(escalation.next_cadence_date)}
                </dd>
              </div>
            )}
            {escalation.elevated_at && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">
                  Elevated
                </dt>
                <dd className="font-medium text-brand-700">
                  {formatDate(escalation.elevated_at)}
                  {elevatedBy ? ` by ${elevatedBy.name}` : ""}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Description
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {escalation.description}
            </p>
          </section>

          {isCare2 && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Care 2 cadence touchpoints
              </h2>
              <p className="mb-4 text-xs text-slate-400">
                Cadence: every {escalation.cadence_days ?? 1} day
                {(escalation.cadence_days ?? 1) === 1 ? "" : "s"} ·{" "}
                {touchpoints.length} logged
              </p>

              {canEdit && (
                <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                  <TouchpointForm
                    escalationId={escalation.id}
                    cadenceDays={escalation.cadence_days ?? 1}
                  />
                </div>
              )}

              <ol className="space-y-4">
                {touchpoints.map((tp) => (
                  <li key={tp.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-800">
                        {formatDate(tp.touchpoint_date)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {tp.author?.name ?? "Unknown"}
                        {tp.next_cadence_date
                          ? ` · next: ${formatDate(tp.next_cadence_date)}`
                          : ""}
                      </p>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                      {tp.notes}
                    </p>
                    {tp.action_items && (
                      <div className="mt-2 rounded-md bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Action items
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                          {tp.action_items}
                        </p>
                      </div>
                    )}
                  </li>
                ))}
                {touchpoints.length === 0 && (
                  <p className="text-sm text-slate-400">No touchpoints logged yet.</p>
                )}
              </ol>
            </section>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Notes ({comments.length})
            </h2>
            <ol className="mb-6 space-y-4">
              {comments.map((c) => (
                <li key={c.id} className="border-l-2 border-slate-200 pl-4">
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-semibold text-slate-800">
                      {c.author?.name ?? "Unknown"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDateTime(c.created_at)}
                      {c.status_context ? ` · ${c.status_context.replace("_", " ")}` : ""}
                    </p>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                    {c.body}
                  </p>
                </li>
              ))}
              {comments.length === 0 && (
                <p className="text-sm text-slate-400">No notes yet.</p>
              )}
            </ol>
            <CommentForm escalationId={escalation.id} />
          </section>

          {canEdit && escalation.status !== "archived" && (
            <details className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <summary className="cursor-pointer px-6 py-4 text-sm font-semibold text-slate-700">
                Edit escalation details
              </summary>
              <div className="border-t border-slate-100 p-6">
                <EscalationForm
                  mode="edit"
                  escalation={escalation}
                  tiers={tiers}
                  types={types}
                  members={members}
                  accounts={accounts}
                  settings={settings}
                  currentMemberId={member.id}
                />
              </div>
            </details>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Workflow
            </h2>
            <StatusControls
              escalationId={escalation.id}
              status={escalation.status}
              canEdit={canEdit}
              isAdmin={member.role === "admin"}
            />
          </section>

          {isCare3 && (
            <section className="rounded-xl border border-red-200 bg-white p-5 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-700">
                Executive elevation
              </h2>
              <p className="mb-3 text-xs text-slate-500">
                {escalation.elevated_at
                  ? `Last elevated ${formatDateTime(escalation.elevated_at)}.`
                  : "Leadership has not been notified yet. Elevation is always an explicit action — never automatic."}
              </p>
              <ElevateButton
                escalationId={escalation.id}
                elevatedAt={escalation.elevated_at}
                chainEnabled={settings.care3_visibility_chain.enabled}
                canEdit={canEdit}
              />
            </section>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              AI summary (SPINA)
            </h2>
            <AiSummaryPanel
              escalationId={escalation.id}
              latest={
                latestSummary
                  ? {
                      content: latestSummary.content,
                      created_at: latestSummary.created_at,
                      model: latestSummary.model,
                    }
                  : null
              }
            />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Activity
            </h2>
            <ol className="space-y-2">
              {audit.slice(0, 12).map((entry) => (
                <li key={entry.id} className="text-xs text-slate-500">
                  <span className="font-medium text-slate-700">
                    {(entry as { actor?: { name?: string } }).actor?.name ?? "System"}
                  </span>{" "}
                  {String(entry.action).replace(/[._]/g, " ")}
                  <span className="block text-[11px] text-slate-400">
                    {formatDateTime(entry.created_at)}
                  </span>
                </li>
              ))}
              {audit.length === 0 && (
                <p className="text-xs text-slate-400">No activity recorded.</p>
              )}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
