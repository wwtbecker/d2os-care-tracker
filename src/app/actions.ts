"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/supabase";
import {
  createNotification,
  getEscalation,
  getSettings,
  getTeamMembers,
  logAudit,
  saveSetting,
} from "@/lib/data";
import { canEditEscalation, isAdmin } from "@/lib/permissions";
import { requireMember, requireAdmin } from "@/lib/session";
import { addDaysISO, todayISO } from "@/lib/format";
import type { EscalationStatus } from "@/lib/types";

export type ActionResult = { error?: string; ok?: boolean } | void;

function str(formData: FormData, key: string): string {
  return (formData.get(key) as string | null)?.trim() ?? "";
}

function optional(formData: FormData, key: string): string | null {
  const v = str(formData, key);
  return v === "" ? null : v;
}

// ---------------------------------------------------------------------------
// Accounts (manual Gainsight stub)
// ---------------------------------------------------------------------------

async function findOrCreateAccount(
  name: string,
  createdBy: string
): Promise<string> {
  const supabase = db();
  const { data: existing } = await supabase
    .from("accounts")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("accounts")
    .insert({ name, source: "manual", created_by: createdBy })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Account create failed");
  return data.id;
}

export async function createAccount(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const member = await requireMember();
  const name = str(formData, "name");
  if (!name) return { error: "Account name is required." };

  const { error } = await db().from("accounts").insert({
    name,
    gainsight_id: optional(formData, "gainsight_id"),
    industry: optional(formData, "industry"),
    notes: optional(formData, "notes"),
    source: "manual",
    created_by: member.id,
  });
  if (error) {
    return {
      error: error.code === "23505" ? "An account with that name already exists." : error.message,
    };
  }
  revalidatePath("/accounts");
  return { ok: true };
}

export async function updateAccount(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireMember();
  const id = str(formData, "id");
  const name = str(formData, "name");
  if (!id || !name) return { error: "Account name is required." };

  const { error } = await db()
    .from("accounts")
    .update({
      name,
      gainsight_id: optional(formData, "gainsight_id"),
      industry: optional(formData, "industry"),
      notes: optional(formData, "notes"),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/accounts");
  return { ok: true };
}

/**
 * Admin-only soft archive: hides the account from active lists and pickers
 * while keeping it viewable and restorable under "Archived accounts".
 * Open escalations linked to the account are untouched — the UI warns but
 * never blocks, since this exists to clean up test/junk POC data.
 */
export async function archiveAccount(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  if (!id) return { error: "Account id is required." };

  const { data, error } = await db()
    .from("accounts")
    .update({ archived_at: new Date().toISOString(), archived_by: admin.id })
    .eq("id", id)
    .select("name")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Account not found." };

  await logAudit({
    actor_id: admin.id,
    action: "account.archived",
    details: { account_id: id, name: data.name },
  });
  revalidatePath("/accounts");
  return { ok: true };
}

export async function restoreAccount(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  if (!id) return { error: "Account id is required." };

  const { data, error } = await db()
    .from("accounts")
    .update({ archived_at: null, archived_by: null })
    .eq("id", id)
    .select("name")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Account not found." };

  await logAudit({
    actor_id: admin.id,
    action: "account.restored",
    details: { account_id: id, name: data.name },
  });
  revalidatePath("/accounts");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Escalations
// ---------------------------------------------------------------------------

export async function createEscalation(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const member = await requireMember();
  const settings = await getSettings();

  const title = str(formData, "title");
  const description = str(formData, "description");
  const tierKey = str(formData, "tier_key");
  const accountId = optional(formData, "account_id");
  const accountName = str(formData, "account_name");
  const ownerId = optional(formData, "owner_id") ?? member.id;

  if (!title) return { error: "Title is required." };
  if (!description) return { error: "Description is required." };
  if (!tierKey) return { error: "Care tier is required." };
  if (!accountId && !accountName) return { error: "Account is required." };

  const supabase = db();

  let resolvedAccountId = accountId;
  let resolvedAccountName = accountName;
  if (accountId) {
    const { data: account } = await supabase
      .from("accounts")
      .select("name")
      .eq("id", accountId)
      .maybeSingle();
    if (!account) return { error: "Selected account no longer exists." };
    resolvedAccountName = account.name;
  } else {
    resolvedAccountId = await findOrCreateAccount(accountName, member.id);
  }

  // Care 2 cadence defaults
  const isCare2 = tierKey === "care_2";
  const cadenceDays = isCare2
    ? Number(optional(formData, "cadence_days") ?? settings.care2_default_cadence_days)
    : null;
  const nextCadence = isCare2
    ? optional(formData, "next_cadence_date") ??
      addDaysISO(todayISO(), cadenceDays ?? 1)
    : null;

  const { data, error } = await supabase
    .from("escalations")
    .insert({
      account_id: resolvedAccountId,
      account_name: resolvedAccountName,
      title,
      description,
      tier_key: tierKey,
      type_key: settings.types_enabled ? optional(formData, "type_key") : null,
      owner_id: ownerId,
      created_by: member.id,
      opened_at: optional(formData, "opened_at") ?? todayISO(),
      target_resolution_date: optional(formData, "target_resolution_date"),
      executive_reporting: tierKey === "care_3",
      cadence_days: cadenceDays,
      next_cadence_date: nextCadence,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Create failed." };

  await logAudit({
    actor_id: member.id,
    action: "escalation.created",
    escalation_id: data.id,
    details: { tier: tierKey, account: resolvedAccountName },
  });

  if (ownerId !== member.id) {
    await createNotification({
      recipient_id: ownerId,
      escalation_id: data.id,
      kind: "assignment",
      title: `Assigned: ${resolvedAccountName}`,
      body: `${member.name} assigned you the escalation “${title}”.`,
    });
  }

  revalidatePath("/escalations");
  revalidatePath("/");
  redirect(`/escalations/${data.id}`);
}

export async function updateEscalation(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const member = await requireMember();
  const id = str(formData, "id");
  const escalation = await getEscalation(id);
  if (!escalation) return { error: "Escalation not found." };
  if (!canEditEscalation(member, escalation)) {
    return { error: "Only the assigned owner or an administrator can edit this escalation." };
  }

  const settings = await getSettings();
  const title = str(formData, "title");
  const description = str(formData, "description");
  const tierKey = str(formData, "tier_key");
  const ownerId = str(formData, "owner_id");
  if (!title || !description || !tierKey || !ownerId) {
    return { error: "Title, description, tier, and owner are required." };
  }

  const isCare2 = tierKey === "care_2";
  const updates: Record<string, unknown> = {
    title,
    description,
    tier_key: tierKey,
    type_key: settings.types_enabled ? optional(formData, "type_key") : escalation.type_key,
    owner_id: ownerId,
    opened_at: optional(formData, "opened_at") ?? escalation.opened_at,
    target_resolution_date: optional(formData, "target_resolution_date"),
    executive_reporting:
      tierKey === "care_3" ? true : formData.get("executive_reporting") === "on",
    cadence_days: isCare2
      ? Number(optional(formData, "cadence_days") ?? settings.care2_default_cadence_days)
      : null,
    next_cadence_date: isCare2 ? optional(formData, "next_cadence_date") : null,
  };

  const { error } = await db().from("escalations").update(updates).eq("id", id);
  if (error) return { error: error.message };

  await logAudit({
    actor_id: member.id,
    action: "escalation.updated",
    escalation_id: id,
    details: { tier: tierKey },
  });

  if (ownerId !== escalation.owner_id) {
    await createNotification({
      recipient_id: ownerId,
      escalation_id: id,
      kind: "assignment",
      title: `Assigned: ${escalation.account_name}`,
      body: `${member.name} reassigned the escalation “${title}” to you.`,
    });
  }

  revalidatePath(`/escalations/${id}`);
  revalidatePath("/escalations");
  revalidatePath("/");
  return { ok: true };
}

export async function changeStatus(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const member = await requireMember();
  const id = str(formData, "id");
  const status = str(formData, "status") as EscalationStatus;
  const note = optional(formData, "note");

  if (!["open", "in_progress", "resolved", "archived"].includes(status)) {
    return { error: "Invalid status." };
  }

  const escalation = await getEscalation(id);
  if (!escalation) return { error: "Escalation not found." };
  if (!canEditEscalation(member, escalation)) {
    return { error: "Only the assigned owner or an administrator can change status." };
  }
  if (status === "archived" && !isAdmin(member)) {
    return { error: "Only an administrator can archive manually." };
  }

  const updates: Record<string, unknown> = { status };
  if (status === "resolved") {
    updates.resolved_at = new Date().toISOString();
  } else if (status === "open" || status === "in_progress") {
    updates.resolved_at = null;
    updates.archived_at = null;
  } else if (status === "archived") {
    updates.archived_at = new Date().toISOString();
  }

  const { error } = await db().from("escalations").update(updates).eq("id", id);
  if (error) return { error: error.message };

  if (note) {
    await db().from("escalation_comments").insert({
      escalation_id: id,
      author_id: member.id,
      body: note,
      status_context: status,
    });
  }

  await logAudit({
    actor_id: member.id,
    action: "escalation.status_changed",
    escalation_id: id,
    details: { from: escalation.status, to: status },
  });

  revalidatePath(`/escalations/${id}`);
  revalidatePath("/escalations");
  revalidatePath("/");
  return { ok: true };
}

export async function addComment(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const member = await requireMember();
  const id = str(formData, "id");
  const body = str(formData, "body");
  if (!body) return { error: "Note text is required." };

  const escalation = await getEscalation(id);
  if (!escalation) return { error: "Escalation not found." };

  // Any team member may comment (everyone can view); only owner/admin can
  // change the record itself.
  const { error } = await db().from("escalation_comments").insert({
    escalation_id: id,
    author_id: member.id,
    body,
    status_context: escalation.status,
  });
  if (error) return { error: error.message };

  revalidatePath(`/escalations/${id}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Care 2 cadence touchpoints
// ---------------------------------------------------------------------------

export async function addTouchpoint(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const member = await requireMember();
  const id = str(formData, "id");
  const notes = str(formData, "notes");
  if (!notes) return { error: "Touchpoint notes are required." };

  const escalation = await getEscalation(id);
  if (!escalation) return { error: "Escalation not found." };
  if (!canEditEscalation(member, escalation)) {
    return { error: "Only the assigned owner or an administrator can log touchpoints." };
  }

  const touchpointDate = optional(formData, "touchpoint_date") ?? todayISO();
  const nextCadence =
    optional(formData, "next_cadence_date") ??
    addDaysISO(touchpointDate, escalation.cadence_days ?? 1);

  const supabase = db();
  const { error } = await supabase.from("cadence_touchpoints").insert({
    escalation_id: id,
    touchpoint_date: touchpointDate,
    notes,
    action_items: optional(formData, "action_items"),
    next_cadence_date: nextCadence,
    created_by: member.id,
  });
  if (error) return { error: error.message };

  // Advance the escalation's cadence pointer.
  await supabase
    .from("escalations")
    .update({ next_cadence_date: nextCadence })
    .eq("id", id);

  await logAudit({
    actor_id: member.id,
    action: "touchpoint.logged",
    escalation_id: id,
    details: { date: touchpointDate, next: nextCadence },
  });

  revalidatePath(`/escalations/${id}`);
  revalidatePath("/");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Care 3: explicit manual elevation to leadership
// ---------------------------------------------------------------------------

export async function elevateEscalation(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const member = await requireMember();
  const id = str(formData, "id");

  const escalation = await getEscalation(id);
  if (!escalation) return { error: "Escalation not found." };
  if (!canEditEscalation(member, escalation)) {
    return { error: "Only the assigned owner or an administrator can elevate." };
  }
  if (escalation.tier_key !== "care_3") {
    return { error: "Only Care 3 escalations can be elevated to leadership." };
  }

  const settings = await getSettings();
  const chain = settings.care3_visibility_chain;

  const { error } = await db()
    .from("escalations")
    .update({
      elevated_at: new Date().toISOString(),
      elevated_by: member.id,
      executive_reporting: true,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  // Always notify app administrators (Elena).
  const members = await getTeamMembers();
  const admins = members.filter((m) => m.role === "admin" && m.id !== member.id);
  for (const admin of admins) {
    await createNotification({
      recipient_id: admin.id,
      escalation_id: id,
      kind: "elevation",
      title: `Care 3 elevated: ${escalation.account_name}`,
      body: `${member.name} elevated “${escalation.title}” for leadership visibility.`,
    });
  }

  // Configurable visibility chain (Nickl → Dobry → Wynne) — only when Elena
  // has enabled it in Admin settings. Chain members with app accounts get an
  // in-app notification; the full ordered chain is captured in the audit
  // record either way (the formal reporting trail).
  const chainNotified: string[] = [];
  if (chain.enabled) {
    for (const recipient of chain.recipients) {
      const match = members.find(
        (m) => m.email.toLowerCase() === recipient.email.toLowerCase()
      );
      if (match && match.id !== member.id) {
        await createNotification({
          recipient_id: match.id,
          escalation_id: id,
          kind: "elevation",
          title: `Care 3 elevated: ${escalation.account_name}`,
          body: `${member.name} elevated “${escalation.title}”. You are on the executive visibility chain.`,
        });
      }
      chainNotified.push(`${recipient.name} <${recipient.email}>`);
    }
  }

  await logAudit({
    actor_id: member.id,
    action: "escalation.elevated",
    escalation_id: id,
    details: {
      chain_enabled: chain.enabled,
      chain_recipients: chainNotified,
      admins_notified: admins.map((a) => a.email),
    },
  });

  revalidatePath(`/escalations/${id}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function markNotificationRead(formData: FormData): Promise<void> {
  const member = await requireMember();
  const id = str(formData, "id");
  await db()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("recipient_id", member.id);
  revalidatePath("/notifications");
  revalidatePath("/");
}

export async function markAllNotificationsRead(): Promise<void> {
  const member = await requireMember();
  await db()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", member.id)
    .is("read_at", null);
  revalidatePath("/notifications");
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// Admin: settings, roster, tiers & types
// ---------------------------------------------------------------------------

export async function saveGeneralSettings(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const member = await requireAdmin();

  const autoArchiveDays = Number(str(formData, "auto_archive_days"));
  const cadenceDays = Number(str(formData, "care2_default_cadence_days"));
  if (!Number.isFinite(autoArchiveDays) || autoArchiveDays < 1) {
    return { error: "Auto-archive days must be a positive number." };
  }
  if (!Number.isFinite(cadenceDays) || cadenceDays < 1) {
    return { error: "Default cadence days must be a positive number." };
  }

  await saveSetting("types_enabled", formData.get("types_enabled") === "on", member.id);
  await saveSetting("auto_archive_days", autoArchiveDays, member.id);
  await saveSetting("care2_default_cadence_days", cadenceDays, member.id);

  await logAudit({ actor_id: member.id, action: "settings.updated" });
  revalidatePath("/admin");
  return { ok: true };
}

export async function saveVisibilityChain(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const member = await requireAdmin();

  const enabled = formData.get("chain_enabled") === "on";
  const lines = str(formData, "chain_recipients")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const recipients = [];
  for (const line of lines) {
    // Format per line: Name | Title | email
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length !== 3 || !parts[2].includes("@")) {
      return {
        error: `Invalid chain entry: “${line}”. Use: Name | Title | email — one per line, in escalation order.`,
      };
    }
    recipients.push({ name: parts[0], title: parts[1], email: parts[2] });
  }

  await saveSetting("care3_visibility_chain", { enabled, recipients }, member.id);
  await logAudit({
    actor_id: member.id,
    action: "settings.visibility_chain_updated",
    details: { enabled, recipients: recipients.length },
  });
  revalidatePath("/admin");
  return { ok: true };
}

export async function saveTeamMember(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = optional(formData, "id");
  const email = str(formData, "email").toLowerCase();
  const name = str(formData, "name");
  const role = str(formData, "role") === "admin" ? "admin" : "csm";
  const active = formData.get("active") === "on";
  if (!email || !name) return { error: "Name and email are required." };

  const payload = {
    email,
    name,
    title: optional(formData, "title"),
    role,
    active,
  };

  const supabase = db();
  const { error } = id
    ? await supabase.from("team_members").update(payload).eq("id", id)
    : await supabase.from("team_members").insert(payload);
  if (error) {
    return {
      error: error.code === "23505" ? "A member with that email already exists." : error.message,
    };
  }

  await logAudit({
    actor_id: admin.id,
    action: id ? "team_member.updated" : "team_member.added",
    details: { email, role, active },
  });
  revalidatePath("/admin");
  return { ok: true };
}

export async function saveTier(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const key = str(formData, "key")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
  const label = str(formData, "label");
  if (!key || !label) return { error: "Tier key and label are required." };

  const { error } = await db().from("escalation_tiers").upsert({
    key,
    label,
    description: optional(formData, "description"),
    urgency: optional(formData, "urgency"),
    color: optional(formData, "color") ?? "#64748b",
    sort_order: Number(optional(formData, "sort_order") ?? 99),
    active: formData.get("active") === "on",
  });
  if (error) return { error: error.message };

  await logAudit({ actor_id: admin.id, action: "tier.saved", details: { key } });
  revalidatePath("/admin");
  return { ok: true };
}

export async function saveType(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const key = str(formData, "key")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
  const label = str(formData, "label");
  if (!key || !label) return { error: "Type key and label are required." };

  const { error } = await db().from("escalation_types").upsert({
    key,
    label,
    description: optional(formData, "description"),
    sort_order: Number(optional(formData, "sort_order") ?? 99),
    active: formData.get("active") === "on",
  });
  if (error) return { error: error.message };

  await logAudit({ actor_id: admin.id, action: "type.saved", details: { key } });
  revalidatePath("/admin");
  return { ok: true };
}
