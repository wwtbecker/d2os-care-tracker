"use client";

import { useActionState, useState } from "react";
import { createAccount, updateAccount, type ActionResult } from "@/app/actions";
import { FormError, FormSuccess, SubmitButton, inputClass, labelClass } from "@/components/form";
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

export function AccountList({ accounts }: { accounts: Account[] }) {
  const [editing, setEditing] = useState<string | null>(null);

  if (accounts.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
        No accounts yet — add the first customer above.
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
            <button
              onClick={() => setEditing(editing === a.id ? null : a.id)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {editing === a.id ? "Close" : "Edit"}
            </button>
          </div>
          {editing === a.id && (
            <div className="mt-4 rounded-lg bg-slate-50 p-4">
              <AccountForm account={a} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
