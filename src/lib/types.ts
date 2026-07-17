// Domain types mirroring the Supabase schema.

export type Role = "admin" | "csm";

export type EscalationStatus = "open" | "in_progress" | "resolved" | "archived";

export const ESCALATION_STATUSES: EscalationStatus[] = [
  "open",
  "in_progress",
  "resolved",
  "archived",
];

export const STATUS_LABELS: Record<EscalationStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  archived: "Archived",
};

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  title: string | null;
  role: Role;
  active: boolean;
  created_at: string;
}

export interface EscalationTier {
  key: string;
  label: string;
  description: string | null;
  urgency: string | null;
  color: string;
  sort_order: number;
  active: boolean;
}

export interface EscalationType {
  key: string;
  label: string;
  description: string | null;
  sort_order: number;
  active: boolean;
}

export interface Account {
  id: string;
  name: string;
  gainsight_id: string | null;
  industry: string | null;
  notes: string | null;
  source: "manual" | "gainsight";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Escalation {
  id: string;
  account_id: string | null;
  account_name: string;
  title: string;
  description: string;
  tier_key: string;
  type_key: string | null;
  status: EscalationStatus;
  owner_id: string;
  created_by: string | null;
  opened_at: string;
  target_resolution_date: string | null;
  resolved_at: string | null;
  archived_at: string | null;
  executive_reporting: boolean;
  elevated_at: string | null;
  elevated_by: string | null;
  cadence_days: number | null;
  next_cadence_date: string | null;
  created_at: string;
  updated_at: string;
}

/** Escalation with joined display fields (owner, tier). */
export interface EscalationRow extends Escalation {
  owner: Pick<TeamMember, "id" | "name" | "email"> | null;
  tier: EscalationTier | null;
  type: EscalationType | null;
}

export interface EscalationComment {
  id: string;
  escalation_id: string;
  author_id: string;
  body: string;
  status_context: string | null;
  created_at: string;
  author?: Pick<TeamMember, "id" | "name"> | null;
}

export interface CadenceTouchpoint {
  id: string;
  escalation_id: string;
  touchpoint_date: string;
  notes: string;
  action_items: string | null;
  next_cadence_date: string | null;
  created_by: string;
  created_at: string;
  author?: Pick<TeamMember, "id" | "name"> | null;
}

export interface Notification {
  id: string;
  recipient_id: string;
  escalation_id: string | null;
  kind: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

export interface AiOutput {
  id: string;
  escalation_id: string | null;
  kind: "spina_summary" | "classification" | "exec_summary";
  content: string;
  model: string;
  created_by: string | null;
  created_at: string;
}

export interface VisibilityChainRecipient {
  name: string;
  title: string;
  email: string;
}

export interface VisibilityChain {
  enabled: boolean;
  recipients: VisibilityChainRecipient[];
}

export interface AppSettings {
  types_enabled: boolean;
  auto_archive_days: number;
  care2_default_cadence_days: number;
  care3_visibility_chain: VisibilityChain;
}

export const DEFAULT_SETTINGS: AppSettings = {
  types_enabled: false,
  auto_archive_days: 14,
  care2_default_cadence_days: 1,
  care3_visibility_chain: { enabled: false, recipients: [] },
};

/** Filters accepted by the escalation list. */
export interface EscalationFilters {
  /** "active" = open + in_progress; "all" = every status incl. archived */
  status?: EscalationStatus | "active" | "all";
  tier?: string;
  type?: string;
  owner?: string;
  account?: string;
  q?: string;
  executive?: boolean;
}
