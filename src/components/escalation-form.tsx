"use client";

import { useActionState, useState } from "react";
import { createEscalation, updateEscalation, type ActionResult } from "@/app/actions";
import { FormError, FormSuccess, SubmitButton, inputClass, labelClass } from "@/components/form";
import type {
  Account,
  AppSettings,
  Escalation,
  EscalationTier,
  EscalationType,
  TeamMember,
} from "@/lib/types";

interface Props {
  mode: "create" | "edit";
  escalation?: Escalation;
  tiers: EscalationTier[];
  types: EscalationType[];
  members: TeamMember[];
  accounts: Account[];
  settings: AppSettings;
  currentMemberId: string;
  /** AI tier suggestion is rendered by the parent (server) — this form only
   * exposes the description so the suggestion endpoint can read it. */
}

export function EscalationForm({
  mode,
  escalation,
  tiers,
  types,
  members,
  accounts,
  settings,
  currentMemberId,
}: Props) {
  const action = mode === "create" ? createEscalation : updateEscalation;
  const [state, formAction] = useActionState<ActionResult, FormData>(action, undefined);
  const [tierKey, setTierKey] = useState(escalation?.tier_key ?? "");
  const [accountMode, setAccountMode] = useState<"existing" | "new">(
    mode === "edit" || accounts.length === 0 ? "new" : "existing"
  );
  const [description, setDescription] = useState(escalation?.description ?? "");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  const isCare2 = tierKey === "care_2";

  async function suggestTier() {
    if (!description.trim()) {
      setSuggestion("Enter a description first — the suggestion is based on its content.");
      return;
    }
    setSuggesting(true);
    setSuggestion(null);
    try {
      const res = await fetch("/api/ai/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Suggestion failed");
      const tier = tiers.find((t) => t.key === data.tier_key);
      if (tier) setTierKey(tier.key);
      setSuggestion(
        `Suggested ${tier?.label ?? data.tier_key}${
          data.type_label ? ` · ${data.type_label}` : ""
        } — ${data.rationale}`
      );
    } catch (err) {
      setSuggestion(err instanceof Error ? err.message : "Suggestion failed.");
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <form action={formAction} className="space-y-5">
      {escalation && <input type="hidden" name="id" value={escalation.id} />}
      <FormError error={state?.error} />
      <FormSuccess show={state?.ok && mode === "edit"} message="Escalation updated." />

      <div>
        <label className={labelClass} htmlFor="title">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={escalation?.title}
          placeholder="Short summary, e.g. “Backup failures across primary datacenter”"
          className={inputClass}
        />
      </div>

      {mode === "create" ? (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className={labelClass + " mb-0"}>Customer account</span>
            <div className="flex gap-1 text-xs">
              <button
                type="button"
                onClick={() => setAccountMode("existing")}
                className={`rounded px-2 py-0.5 ${accountMode === "existing" ? "bg-ink-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}
              >
                Existing
              </button>
              <button
                type="button"
                onClick={() => setAccountMode("new")}
                className={`rounded px-2 py-0.5 ${accountMode === "new" ? "bg-ink-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}
              >
                New
              </button>
            </div>
          </div>
          {accountMode === "existing" ? (
            <select name="account_id" className={inputClass} defaultValue="">
              <option value="" disabled>
                Select an account…
              </option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.gainsight_id ? ` (Gainsight: ${a.gainsight_id})` : ""}
                </option>
              ))}
            </select>
          ) : (
            <input
              name="account_name"
              placeholder="Account name (creates a manual record — Gainsight link can be added later)"
              className={inputClass}
            />
          )}
          <p className="mt-1 text-xs text-slate-400">
            Accounts are manual records today; each carries a Gainsight ID
            field so records reconcile automatically when the live connector
            ships.
          </p>
        </div>
      ) : (
        <div>
          <label className={labelClass}>Customer account</label>
          <input
            className={inputClass + " bg-slate-50"}
            value={escalation?.account_name ?? ""}
            disabled
          />
        </div>
      )}

      <div>
        <label className={labelClass} htmlFor="description">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is happening, business impact, who is engaged, current state…"
          className={inputClass}
        />
        <div className="mt-2 flex items-start gap-3">
          <button
            type="button"
            onClick={suggestTier}
            disabled={suggesting}
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            {suggesting ? "Analyzing…" : "✦ Suggest tier with AI"}
          </button>
          {suggestion && <p className="text-xs text-slate-500">{suggestion}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="tier_key">
            Care tier
          </label>
          <select
            id="tier_key"
            name="tier_key"
            required
            value={tierKey}
            onChange={(e) => setTierKey(e.target.value)}
            className={inputClass}
          >
            <option value="" disabled>
              Select a tier…
            </option>
            {tiers.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label} — {t.urgency} urgency
              </option>
            ))}
          </select>
        </div>

        {settings.types_enabled && (
          <div>
            <label className={labelClass} htmlFor="type_key">
              Escalation type
            </label>
            <select
              id="type_key"
              name="type_key"
              defaultValue={escalation?.type_key ?? ""}
              className={inputClass}
            >
              <option value="">— None —</option>
              {types.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor="owner_id">
            CSM owner
          </label>
          <select
            id="owner_id"
            name="owner_id"
            defaultValue={escalation?.owner_id ?? currentMemberId}
            className={inputClass}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">
            Pre-filled from your SSO identity.
          </p>
        </div>

        <div>
          <label className={labelClass} htmlFor="opened_at">
            Date opened
          </label>
          <input
            id="opened_at"
            name="opened_at"
            type="date"
            defaultValue={escalation?.opened_at ?? new Date().toISOString().slice(0, 10)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="target_resolution_date">
            Target resolution date
          </label>
          <input
            id="target_resolution_date"
            name="target_resolution_date"
            type="date"
            defaultValue={escalation?.target_resolution_date ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      {isCare2 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-3 text-sm font-medium text-amber-900">
            Care 2 cadence — recurring touchpoints
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="cadence_days">
                Cadence interval (days)
              </label>
              <input
                id="cadence_days"
                name="cadence_days"
                type="number"
                min={1}
                defaultValue={
                  escalation?.cadence_days ?? settings.care2_default_cadence_days
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="next_cadence_date">
                Next touchpoint due
              </label>
              <input
                id="next_cadence_date"
                name="next_cadence_date"
                type="date"
                defaultValue={escalation?.next_cadence_date ?? ""}
                className={inputClass}
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-amber-700">
            You&apos;ll get a “touchpoint due” notification whenever the next
            cadence date arrives.
          </p>
        </div>
      )}

      {tierKey === "care_3" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-medium">Care 3 — executive visibility</p>
          <p className="mt-1 text-xs text-red-700">
            This escalation will be flagged for executive reporting. Leadership
            is <strong>not</strong> notified automatically — use the explicit
            “Elevate to leadership” action on the escalation page when you and
            Elena decide it&apos;s time.
          </p>
        </div>
      )}

      {mode === "edit" && tierKey !== "care_3" && (
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            name="executive_reporting"
            defaultChecked={escalation?.executive_reporting}
            className="h-4 w-4 rounded border-slate-300"
          />
          Include in executive reporting / Care 3 export
        </label>
      )}

      <div className="flex gap-3 pt-2">
        <SubmitButton>
          {mode === "create" ? "Log escalation" : "Save changes"}
        </SubmitButton>
      </div>
    </form>
  );
}
