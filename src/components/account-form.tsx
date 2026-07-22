"use client";

import { useActionState, useState } from "react";
import {
  archiveAccount,
  createAccount,
  restoreAccount,
  updateAccount,
  type ActionResult,
} from "@/app/actions";
import { FormError, FormSuccess, SubmitButton, inputClass, labelClass } from "@/components/form";
import { formatDate } from "@/lib/format";
import type { Account } from "@/lib/types";

export function AccountForm({ account }: { account?: Account }) {
  const action = account ? updateAccount : createAccount;
  const [state, formAction] = useActionState<ActionResult, FormData>(action, undefined);

  return (
    <form action={formAction} className="space-y-4">
      {account && <input type="hidden" name="id" value={account.id} />}
      <FormError error={state?.error} />
      <FormSuccess show={state?.ok} message={account ? "Account updated." : "Account created."} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Account name</label>
          <input name="name" required defaultValue={account?.name} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Gainsight company ID</label>
          <input
            name="gainsight_id"
            defaultValue={account?.gainsight_id ?? ""}
            placeholder="Optional — used to reconcile when the connector goes live"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Industry</label>
          <input name="industry" defaultValue={account?.industry ?? ""} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Notes</label>
          <textarea name="notes" rows={2} defaultValue={account?.notes ?? ""} className={inputClass} />
        </div>
      </div>
      <SubmitButton variant={account ? "secondary" : "primary"}>
        {account ? "Save" : "Add account"}
      </SubmitButton>
    </form>
  );
}

export function AccountList({
  accounts,
  isAdmin = false,
  openCounts = {},
}: {
  accounts: Account[];
  isAdmin?: boolean;
  openCounts?: Record<string, number>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);

  if (accounts.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
        No active accounts — add the first customer above.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
      {accounts.map((a) => (
        <li key={a.id} className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-slate-900">{a.name}</p>
              <p className="text-xs text-slate-400">
                {a.gainsight_id
                  ? `Gainsight: ${a.gainsight_id}`
                  : "No Gainsight link yet"}
                {a.industry ? ` · ${a.industry}` : ""}
                {` · ${a.source === "manual" ? "manual entry" : "synced from Gainsight"}`}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => {
                  setEditing(editing === a.id ? null : a.id);
                  setArchiving(null);
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {editing === a.id ? "Close" : "Edit"}
              </button>
              {isAdmin && (
                <button
                  onClick={() => {
                    setArchiving(archiving === a.id ? null : a.id);
                    setEditing(null);
                  }}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                >
                  {archiving === a.id ? "Cancel" : "Archive"}
                </button>
              )}
            </div>
          </div>
          {editing === a.id && (
            <div className="mt-4 rounded-lg bg-slate-50 p-4">
              <AccountForm account={a} />
            </div>
          )}
          {archiving === a.id && (
            <ArchiveAccountConfirm
              account={a}
              openCount={openCounts[a.id] ?? 0}
              onCancel={() => setArchiving(null)}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function ArchiveAccountConfirm({
  account,
  openCount,
  onCancel,
}: {
  account: Account;
  openCount: number;
  onCancel: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    archiveAccount,
    undefined
  );

  return (
    <form
      action={formAction}
      className="mt-4 space-y-3 rounded-lg border border-red-200 bg-red-50 p-4"
    >
      <input type="hidden" name="id" value={account.id} />
      <FormError error={state?.error} />
      {openCount > 0 && (
        <p className="text-xs font-semibold text-red-800">
          ⚠ This account has {openCount} open escalation
          {openCount === 1 ? "" : "s"} linked to it. Archiving the account does
          not change those escalations — they stay active and keep working.
        </p>
      )}
      <p className="text-xs text-red-800">
        Archive “{account.name}”? It disappears from the active account list
        and pickers but stays viewable under Archived accounts — nothing is
        deleted, and an admin can restore it at any time.
      </p>
      <div className="flex gap-2">
        <SubmitButton variant="danger">Archive account</SubmitButton>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ArchivedAccountList({
  accounts,
  isAdmin = false,
}: {
  accounts: Account[];
  isAdmin?: boolean;
}) {
  if (accounts.length === 0) return null;

  return (
    <details className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <summary className="cursor-pointer px-6 py-4 text-sm font-semibold text-slate-700">
        Archived accounts ({accounts.length})
      </summary>
      <ul className="divide-y divide-slate-100 border-t border-slate-100">
        {accounts.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-medium text-slate-500">{a.name}</p>
              <p className="text-xs text-slate-400">
                Archived {a.archived_at ? formatDate(a.archived_at) : "—"}
                {a.gainsight_id ? ` · Gainsight: ${a.gainsight_id}` : ""}
                {a.industry ? ` · ${a.industry}` : ""}
              </p>
            </div>
            {isAdmin && <RestoreAccountButton accountId={a.id} />}
          </li>
        ))}
      </ul>
    </details>
  );
}

function RestoreAccountButton({ accountId }: { accountId: string }) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    restoreAccount,
    undefined
  );
  return (
    <form action={formAction} className="flex shrink-0 items-center gap-2">
      <input type="hidden" name="id" value={accountId} />
      <FormError error={state?.error} />
      <SubmitButton variant="secondary">Restore</SubmitButton>
    </form>
  );
}
