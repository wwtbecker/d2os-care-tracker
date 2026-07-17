import { db } from "./supabase";
import {
  Account,
  AiOutput,
  AppSettings,
  CadenceTouchpoint,
  DEFAULT_SETTINGS,
  EscalationComment,
  EscalationFilters,
  EscalationRow,
  EscalationTier,
  EscalationType,
  Notification,
  TeamMember,
} from "./types";

const ESCALATION_SELECT = `
  *,
  owner:team_members!escalations_owner_id_fkey(id,name,email),
  tier:escalation_tiers!escalations_tier_key_fkey(*),
  type:escalation_types!escalations_type_key_fkey(*)
`;

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown database error"}`);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function getSettings(): Promise<AppSettings> {
  const { data, error } = await db().from("app_settings").select("key,value");
  if (error) fail("Failed to load settings", error);

  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  return {
    types_enabled: map.types_enabled ?? DEFAULT_SETTINGS.types_enabled,
    auto_archive_days: map.auto_archive_days ?? DEFAULT_SETTINGS.auto_archive_days,
    care2_default_cadence_days:
      map.care2_default_cadence_days ?? DEFAULT_SETTINGS.care2_default_cadence_days,
    care3_visibility_chain:
      map.care3_visibility_chain ?? DEFAULT_SETTINGS.care3_visibility_chain,
  };
}

export async function saveSetting(key: string, value: unknown, updatedBy: string) {
  const { error } = await db()
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString(), updated_by: updatedBy });
  if (error) fail(`Failed to save setting ${key}`, error);
}

// ---------------------------------------------------------------------------
// Team members
// ---------------------------------------------------------------------------

export async function getTeamMemberByEmail(email: string): Promise<TeamMember | null> {
  const { data, error } = await db()
    .from("team_members")
    .select("*")
    .ilike("email", email)
    .maybeSingle();
  if (error) fail("Failed to load team member", error);
  return data;
}

export async function getTeamMemberById(id: string): Promise<TeamMember | null> {
  const { data, error } = await db()
    .from("team_members")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) fail("Failed to load team member", error);
  return data;
}

export async function getTeamMembers(includeInactive = false): Promise<TeamMember[]> {
  let query = db().from("team_members").select("*").order("name");
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) fail("Failed to load team members", error);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Tiers & types (configurable enums)
// ---------------------------------------------------------------------------

export async function getTiers(includeInactive = false): Promise<EscalationTier[]> {
  let query = db().from("escalation_tiers").select("*").order("sort_order");
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) fail("Failed to load tiers", error);
  return data ?? [];
}

export async function getTypes(includeInactive = false): Promise<EscalationType[]> {
  let query = db().from("escalation_types").select("*").order("sort_order");
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) fail("Failed to load types", error);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Accounts (manual Gainsight stub)
// ---------------------------------------------------------------------------

export async function getAccounts(): Promise<Account[]> {
  const { data, error } = await db().from("accounts").select("*").order("name");
  if (error) fail("Failed to load accounts", error);
  return data ?? [];
}

export async function searchAccounts(q: string): Promise<Account[]> {
  const { data, error } = await db()
    .from("accounts")
    .select("*")
    .ilike("name", `%${q}%`)
    .order("name")
    .limit(10);
  if (error) fail("Failed to search accounts", error);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Escalations
// ---------------------------------------------------------------------------

export async function getEscalations(
  filters: EscalationFilters = {}
): Promise<EscalationRow[]> {
  let query = db()
    .from("escalations")
    .select(ESCALATION_SELECT)
    .order("opened_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.status === "active") {
    query = query.in("status", ["open", "in_progress"]);
  } else if (filters.status === "all") {
    // no status filter — full history, used by reporting/exports
  } else if (filters.status) {
    query = query.eq("status", filters.status);
  } else {
    // Default view excludes archived history (visible under /archive)
    query = query.neq("status", "archived");
  }
  if (filters.tier) query = query.eq("tier_key", filters.tier);
  if (filters.type) query = query.eq("type_key", filters.type);
  if (filters.owner) query = query.eq("owner_id", filters.owner);
  if (filters.account) query = query.eq("account_id", filters.account);
  if (filters.executive) query = query.eq("executive_reporting", true);
  if (filters.q) {
    const term = `%${filters.q.replaceAll("%", "\\%")}%`;
    query = query.or(
      `title.ilike.${term},description.ilike.${term},account_name.ilike.${term}`
    );
  }

  const { data, error } = await query;
  if (error) fail("Failed to load escalations", error);
  return (data ?? []) as unknown as EscalationRow[];
}

export async function getEscalation(id: string): Promise<EscalationRow | null> {
  const { data, error } = await db()
    .from("escalations")
    .select(ESCALATION_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) fail("Failed to load escalation", error);
  return data as unknown as EscalationRow | null;
}

export async function getComments(escalationId: string): Promise<EscalationComment[]> {
  const { data, error } = await db()
    .from("escalation_comments")
    .select("*, author:team_members!escalation_comments_author_id_fkey(id,name)")
    .eq("escalation_id", escalationId)
    .order("created_at", { ascending: true });
  if (error) fail("Failed to load comments", error);
  return (data ?? []) as unknown as EscalationComment[];
}

export async function getTouchpoints(escalationId: string): Promise<CadenceTouchpoint[]> {
  const { data, error } = await db()
    .from("cadence_touchpoints")
    .select("*, author:team_members!cadence_touchpoints_created_by_fkey(id,name)")
    .eq("escalation_id", escalationId)
    .order("touchpoint_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) fail("Failed to load touchpoints", error);
  return (data ?? []) as unknown as CadenceTouchpoint[];
}

export async function getAiOutputs(escalationId: string): Promise<AiOutput[]> {
  const { data, error } = await db()
    .from("ai_outputs")
    .select("*")
    .eq("escalation_id", escalationId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) fail("Failed to load AI outputs", error);
  return data ?? [];
}

export async function getLatestExecSummary(): Promise<AiOutput | null> {
  const { data, error } = await db()
    .from("ai_outputs")
    .select("*")
    .eq("kind", "exec_summary")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail("Failed to load executive summary", error);
  return data;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function getNotifications(
  recipientId: string,
  unreadOnly = false
): Promise<Notification[]> {
  let query = db()
    .from("notifications")
    .select("*")
    .eq("recipient_id", recipientId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (unreadOnly) query = query.is("read_at", null);
  const { data, error } = await query;
  if (error) fail("Failed to load notifications", error);
  return data ?? [];
}

export async function getUnreadCount(recipientId: string): Promise<number> {
  const { count, error } = await db()
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", recipientId)
    .is("read_at", null);
  if (error) fail("Failed to count notifications", error);
  return count ?? 0;
}

export async function createNotification(n: {
  recipient_id: string;
  escalation_id?: string | null;
  kind: string;
  title: string;
  body?: string | null;
}) {
  const { error } = await db().from("notifications").insert(n);
  if (error) fail("Failed to create notification", error);
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export async function logAudit(entry: {
  actor_id: string | null;
  action: string;
  escalation_id?: string | null;
  details?: Record<string, unknown>;
}) {
  // Audit writes must never break the primary operation.
  const { error } = await db().from("audit_log").insert(entry);
  if (error) console.error("audit_log insert failed:", error.message);
}

export async function getAuditForEscalation(escalationId: string) {
  const { data, error } = await db()
    .from("audit_log")
    .select("*, actor:team_members!audit_log_actor_id_fkey(id,name)")
    .eq("escalation_id", escalationId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) fail("Failed to load audit trail", error);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Maintenance: auto-archival + Care 2 cadence reminders.
// Invoked by the daily cron route and opportunistically from the dashboard.
// ---------------------------------------------------------------------------

export async function runMaintenance(): Promise<{
  archived: number;
  cadenceReminders: number;
}> {
  const settings = await getSettings();
  const supabase = db();

  // 1. Auto-archive resolved escalations past the retention window.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - settings.auto_archive_days);
  const { data: archivedRows, error: archiveError } = await supabase
    .from("escalations")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("status", "resolved")
    .lt("resolved_at", cutoff.toISOString())
    .select("id");
  if (archiveError) fail("Auto-archive failed", archiveError);

  // 2. Care 2 cadence reminders: touchpoint due today or overdue.
  const today = new Date().toISOString().slice(0, 10);
  const { data: due, error: dueError } = await supabase
    .from("escalations")
    .select("id, title, account_name, owner_id, next_cadence_date")
    .eq("tier_key", "care_2")
    .in("status", ["open", "in_progress"])
    .not("next_cadence_date", "is", null)
    .lte("next_cadence_date", today);
  if (dueError) fail("Cadence-due lookup failed", dueError);

  let reminders = 0;
  for (const esc of due ?? []) {
    // Dedupe: at most one cadence_due notification per escalation per day.
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("escalation_id", esc.id)
      .eq("recipient_id", esc.owner_id)
      .eq("kind", "cadence_due")
      .gte("created_at", `${today}T00:00:00Z`)
      .limit(1);
    if (existing && existing.length > 0) continue;

    await createNotification({
      recipient_id: esc.owner_id,
      escalation_id: esc.id,
      kind: "cadence_due",
      title: `Touchpoint due: ${esc.account_name}`,
      body: `Care 2 cadence touchpoint for “${esc.title}” was due ${esc.next_cadence_date}.`,
    });
    reminders += 1;
  }

  return { archived: archivedRows?.length ?? 0, cadenceReminders: reminders };
}
