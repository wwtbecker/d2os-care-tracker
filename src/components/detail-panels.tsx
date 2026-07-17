"use client";

import { useActionState, useState } from "react";
import {
  addComment,
  addTouchpoint,
  changeStatus,
  elevateEscalation,
  type ActionResult,
} from "@/app/actions";
import { FormError, SubmitButton, inputClass, labelClass } from "@/components/form";
import type { EscalationStatus } from "@/lib/types";

// ---------------------------------------------------------------------------
// Status workflow: Open → In Progress → Resolved (with note at each stage)
// ---------------------------------------------------------------------------

const TRANSITIONS: Record<EscalationStatus, { to: EscalationStatus; label: string }[]> = {
  open: [{ to: "in_progress", label: "Start progress" }],
  in_progress: [
    { to: "resolved", label: "Mark resolved" },
    { to: "open", label: "Back to open" },
  ],
  resolved: [
    { to: "in_progress", label: "Reopen" },
    { to: "archived", label: "Archive now" },
  ],
  archived: [{ to: "in_progress", label: "Reopen" }],
};

export function StatusControls({
  escalationId,
  status,
  canEdit,
  isAdmin,
}: {
  escalationId: string;
  status: EscalationStatus;
  canEdit: boolean;
  isAdmin: boolean;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    changeStatus,
    undefined
  );
  const [target, setTarget] = useState<EscalationStatus | null>(null);

  if (!canEdit) {
    return (
      <p className="text-xs text-slate-400">
        Only the assigned owner or an administrator can change status.
      </p>
    );
  }

  const options = TRANSITIONS[status].filter(
    (t) => t.to !== "archived" || isAdmin
  );

  return (
    <div className="space-y-3">
      <FormError error={state?.error} />
      {target === null ? (
        <div className="flex flex-wrap gap-2">
          {options.map((t) => (
            <button
              key={t.to}
              onClick={() => setTarget(t.to)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                t.to === "resolved"
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "border border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : (
        <form action={formAction} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <input type="hidden" name="id" value={escalationId} />
          <input type="hidden" name="status" value={target} />
          <label className={labelClass}>
            Note for this stage change ({status.replace("_", " ")} →{" "}
            {target.replace("_", " ")})
          </label>
          <textarea
            name="note"
            rows={2}
            placeholder="Optional but encouraged — what changed?"
            className={inputClass}
          />
          <div className="flex gap-2">
            <SubmitButton>Confirm</SubmitButton>
            <button
              type="button"
              onClick={() => setTarget(null)}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notes / comments
// ---------------------------------------------------------------------------

export function CommentForm({ escalationId }: { escalationId: string }) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    addComment,
    undefined
  );
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={escalationId} />
      <FormError error={state?.error} />
      <textarea
        name="body"
        rows={3}
        required
        placeholder="Add a note — visible to the whole team"
        className={inputClass}
      />
      <SubmitButton variant="secondary">Add note</SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Care 2 touchpoint logging
// ---------------------------------------------------------------------------

export function TouchpointForm({
  escalationId,
  cadenceDays,
}: {
  escalationId: string;
  cadenceDays: number;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    addTouchpoint,
    undefined
  );
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={escalationId} />
      <FormError error={state?.error} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Touchpoint date</label>
          <input
            type="date"
            name="touchpoint_date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>
            Next cadence date (blank = +{cadenceDays}d)
          </label>
          <input type="date" name="next_cadence_date" className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Notes</label>
        <textarea
          name="notes"
          rows={3}
          required
          placeholder="What was covered in the touchpoint / working session?"
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Action items</label>
        <textarea
          name="action_items"
          rows={2}
          placeholder="One per line"
          className={inputClass}
        />
      </div>
      <SubmitButton>Log touchpoint</SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Care 3 elevation
// ---------------------------------------------------------------------------

export function ElevateButton({
  escalationId,
  elevatedAt,
  chainEnabled,
  canEdit,
}: {
  escalationId: string;
  elevatedAt: string | null;
  chainEnabled: boolean;
  canEdit: boolean;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    elevateEscalation,
    undefined
  );
  const [confirming, setConfirming] = useState(false);

  // Collapse the confirmation box once the elevation has gone through — the
  // refreshed record (elevated timestamp, "Re-elevate" label) is the feedback.
  const [prevActionState, setPrevActionState] = useState(state);
  if (state !== prevActionState) {
    setPrevActionState(state);
    if (state?.ok) setConfirming(false);
  }

  return (
    <div className="space-y-2">
      <FormError error={state?.error} />
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          disabled={!canEdit}
          className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {elevatedAt ? "Re-elevate to leadership" : "Elevate to leadership"}
        </button>
      ) : (
        <form action={formAction} className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <input type="hidden" name="id" value={escalationId} />
          <p className="text-xs text-red-800">
            This notifies D2OS administrators (Elena)
            {chainEnabled
              ? " and the configured executive visibility chain"
              : ""}{" "}
            and records a formal elevation entry in the audit trail. Continue?
          </p>
          <div className="flex gap-2">
            <SubmitButton variant="danger">Yes, elevate</SubmitButton>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-white"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
