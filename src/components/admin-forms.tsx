"use client";

import { useActionState, useState } from "react";
import {
  saveGeneralSettings,
  saveTeamMember,
  saveTier,
  saveType,
  saveVisibilityChain,
  type ActionResult,
} from "@/app/actions";
import { FormError, FormSuccess, SubmitButton, inputClass, labelClass } from "@/components/form";
import type {
  AppSettings,
  EscalationTier,
  EscalationType,
  TeamMember,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// General settings
// ---------------------------------------------------------------------------

export function GeneralSettingsForm({ settings }: { settings: AppSettings }) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    saveGeneralSettings,
    undefined
  );
  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />
      <FormSuccess show={state?.ok} message="Settings saved." />

      <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4">
        <input
          type="checkbox"
          name="types_enabled"
          defaultChecked={settings.types_enabled}
          className="mt-0.5 h-4 w-4 rounded border-slate-300"
        />
        <span>
          <span className="block text-sm font-medium text-slate-800">
            Enable escalation types (tiers + types model)
          </span>
          <span className="block text-xs text-slate-500">
            The open design question with Elena: leave off for tiers-only, or
            turn on to add Risk Warning / Operational Problem / Executive
            Visibility everywhere. No schema change either way — flip it any
            time.
          </span>
        </span>
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Auto-archive resolved after (days)</label>
          <input
            type="number"
            name="auto_archive_days"
            min={1}
            defaultValue={settings.auto_archive_days}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Default Care 2 cadence (days)</label>
          <input
            type="number"
            name="care2_default_cadence_days"
            min={1}
            defaultValue={settings.care2_default_cadence_days}
            className={inputClass}
          />
        </div>
      </div>
      <SubmitButton>Save settings</SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Care 3 visibility chain
// ---------------------------------------------------------------------------

export function VisibilityChainForm({ settings }: { settings: AppSettings }) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    saveVisibilityChain,
    undefined
  );
  const chain = settings.care3_visibility_chain;
  const text = chain.recipients
    .map((r) => `${r.name} | ${r.title} | ${r.email}`)
    .join("\n");

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />
      <FormSuccess show={state?.ok} message="Visibility chain saved." />

      <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4">
        <input
          type="checkbox"
          name="chain_enabled"
          defaultChecked={chain.enabled}
          className="mt-0.5 h-4 w-4 rounded border-slate-300"
        />
        <span>
          <span className="block text-sm font-medium text-slate-800">
            Notify the leadership chain on Care 3 elevation
          </span>
          <span className="block text-xs text-slate-500">
            Off by default: elevation only notifies D2OS administrators.
            When on, everyone below is added to the formal elevation record
            (and notified in-app if they have an account), in order.
          </span>
        </span>
      </label>

      <div>
        <label className={labelClass}>
          Chain recipients — one per line: Name | Title | email
        </label>
        <textarea
          name="chain_recipients"
          rows={4}
          defaultValue={text}
          placeholder="Chris Nickl | Director, Engineering Services | chris.nickl@wwt.com"
          className={inputClass + " font-mono text-xs"}
        />
      </div>
      <SubmitButton>Save chain</SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Team roster
// ---------------------------------------------------------------------------

function MemberFields({ member }: { member?: TeamMember }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {member && <input type="hidden" name="id" value={member.id} />}
      <div>
        <label className={labelClass}>Name</label>
        <input name="name" required defaultValue={member?.name} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>WWT email (must match Okta)</label>
        <input
          name="email"
          type="email"
          required
          defaultValue={member?.email}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Title</label>
        <input name="title" defaultValue={member?.title ?? ""} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Role</label>
        <select name="role" defaultValue={member?.role ?? "csm"} className={inputClass}>
          <option value="csm">CSM</option>
          <option value="admin">Administrator (full override)</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          name="active"
          defaultChecked={member?.active ?? true}
          className="h-4 w-4 rounded border-slate-300"
        />
        Active (can sign in)
      </label>
    </div>
  );
}

export function TeamRoster({ members }: { members: TeamMember[] }) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    saveTeamMember,
    undefined
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      <FormError error={state?.error} />
      <FormSuccess show={state?.ok} message="Roster saved." />

      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {members.map((m) => (
          <li key={m.id} className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {m.name}
                  {!m.active && (
                    <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">
                      inactive
                    </span>
                  )}
                  {m.role === "admin" && (
                    <span className="ml-2 rounded bg-ink-900 px-1.5 py-0.5 text-[10px] uppercase text-white">
                      admin
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-400">
                  {m.email}
                  {m.title ? ` · ${m.title}` : ""}
                </p>
              </div>
              <button
                onClick={() => setEditing(editing === m.id ? null : m.id)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                {editing === m.id ? "Close" : "Edit"}
              </button>
            </div>
            {editing === m.id && (
              <form action={formAction} className="mt-4 space-y-3 rounded-lg bg-slate-50 p-4">
                <MemberFields member={m} />
                <SubmitButton variant="secondary">Save member</SubmitButton>
              </form>
            )}
          </li>
        ))}
      </ul>

      {adding ? (
        <form action={formAction} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <MemberFields />
          <div className="flex gap-2">
            <SubmitButton>Add member</SubmitButton>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-500 hover:bg-slate-50"
        >
          + Add team member
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tiers & types (extensible enums)
// ---------------------------------------------------------------------------

export function TierEditor({ tiers }: { tiers: EscalationTier[] }) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    saveTier,
    undefined
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const fields = (tier?: EscalationTier) => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className={labelClass}>Key (stable identifier)</label>
        <input
          name="key"
          required
          defaultValue={tier?.key}
          readOnly={!!tier}
          className={inputClass + (tier ? " bg-slate-100" : "")}
        />
      </div>
      <div>
        <label className={labelClass}>Label</label>
        <input name="label" required defaultValue={tier?.label} className={inputClass} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass}>Description</label>
        <textarea
          name="description"
          rows={2}
          defaultValue={tier?.description ?? ""}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Urgency</label>
        <input name="urgency" defaultValue={tier?.urgency ?? ""} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Badge/chart color</label>
        <input
          name="color"
          type="color"
          defaultValue={tier?.color ?? "#64748b"}
          className="h-10 w-20 cursor-pointer rounded border border-slate-300"
        />
      </div>
      <div>
        <label className={labelClass}>Sort order</label>
        <input
          name="sort_order"
          type="number"
          defaultValue={tier?.sort_order ?? 99}
          className={inputClass}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          name="active"
          defaultChecked={tier?.active ?? true}
          className="h-4 w-4 rounded border-slate-300"
        />
        Active
      </label>
    </div>
  );

  return (
    <div className="space-y-4">
      <FormError error={state?.error} />
      <FormSuccess show={state?.ok} message="Tier saved." />
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {tiers.map((t) => (
          <li key={t.key} className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: t.color }}
                />
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {t.label}{" "}
                    <span className="text-xs font-normal text-slate-400">({t.key})</span>
                    {!t.active && (
                      <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">
                        inactive
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">{t.description}</p>
                </div>
              </div>
              <button
                onClick={() => setEditing(editing === t.key ? null : t.key)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                {editing === t.key ? "Close" : "Edit"}
              </button>
            </div>
            {editing === t.key && (
              <form action={formAction} className="mt-4 space-y-3 rounded-lg bg-slate-50 p-4">
                {fields(t)}
                <SubmitButton variant="secondary">Save tier</SubmitButton>
              </form>
            )}
          </li>
        ))}
      </ul>
      {adding ? (
        <form action={formAction} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          {fields()}
          <div className="flex gap-2">
            <SubmitButton>Add tier</SubmitButton>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-500 hover:bg-slate-50"
        >
          + Add tier
        </button>
      )}
    </div>
  );
}

export function TypeEditor({ types }: { types: EscalationType[] }) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    saveType,
    undefined
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const fields = (type?: EscalationType) => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className={labelClass}>Key (stable identifier)</label>
        <input
          name="key"
          required
          defaultValue={type?.key}
          readOnly={!!type}
          className={inputClass + (type ? " bg-slate-100" : "")}
        />
      </div>
      <div>
        <label className={labelClass}>Label</label>
        <input name="label" required defaultValue={type?.label} className={inputClass} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass}>Description</label>
        <textarea
          name="description"
          rows={2}
          defaultValue={type?.description ?? ""}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Sort order</label>
        <input
          name="sort_order"
          type="number"
          defaultValue={type?.sort_order ?? 99}
          className={inputClass}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          name="active"
          defaultChecked={type?.active ?? true}
          className="h-4 w-4 rounded border-slate-300"
        />
        Active
      </label>
    </div>
  );

  return (
    <div className="space-y-4">
      <FormError error={state?.error} />
      <FormSuccess show={state?.ok} message="Type saved." />
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {types.map((t) => (
          <li key={t.key} className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {t.label}{" "}
                  <span className="text-xs font-normal text-slate-400">({t.key})</span>
                  {!t.active && (
                    <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">
                      inactive
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-400">{t.description}</p>
              </div>
              <button
                onClick={() => setEditing(editing === t.key ? null : t.key)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                {editing === t.key ? "Close" : "Edit"}
              </button>
            </div>
            {editing === t.key && (
              <form action={formAction} className="mt-4 space-y-3 rounded-lg bg-slate-50 p-4">
                {fields(t)}
                <SubmitButton variant="secondary">Save type</SubmitButton>
              </form>
            )}
          </li>
        ))}
      </ul>
      {adding ? (
        <form action={formAction} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          {fields()}
          <div className="flex gap-2">
            <SubmitButton>Add type</SubmitButton>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-500 hover:bg-slate-50"
        >
          + Add type
        </button>
      )}
    </div>
  );
}
