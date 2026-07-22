import { getComments, getEscalations, getTouchpoints } from "./data";
import { formatDate } from "./format";
import { STATUS_LABELS } from "./types";
import type { EscalationComment, EscalationRow } from "./types";

/**
 * Shared Care 3 / executive-reporting data used by the weekly executive
 * summary, the leadership PowerPoint export, and the Leadership Status
 * Update email draft — one selection rule so all three stay consistent.
 */
export function isExecutiveVisible(e: EscalationRow): boolean {
  return e.tier_key === "care_3" || e.executive_reporting;
}

export async function getExecutiveEscalations(): Promise<EscalationRow[]> {
  const active = await getEscalations({ status: "active" });
  return active.filter(isExecutiveVisible);
}

export interface Care3Detail {
  escalation: EscalationRow;
  comments: EscalationComment[];
  latestNote: string | null;
  latestTouchpoint: string | null;
}

export async function getExecutiveDetails(
  escalations: EscalationRow[]
): Promise<Care3Detail[]> {
  return Promise.all(
    escalations.map(async (e) => {
      const [comments, touchpoints] = await Promise.all([
        getComments(e.id),
        getTouchpoints(e.id),
      ]);
      const lastComment = comments[comments.length - 1];
      const lastTouchpoint = touchpoints[0];
      return {
        escalation: e,
        comments,
        latestNote: lastComment ? lastComment.body : null,
        latestTouchpoint: lastTouchpoint
          ? lastTouchpoint.action_items || lastTouchpoint.notes
          : null,
      };
    })
  );
}

// ---------------------------------------------------------------------------
// Template-based (non-AI) email draft. Always available: built directly from
// the escalation records, so the feature works without ANTHROPIC_API_KEY.
// ---------------------------------------------------------------------------

export interface EmailDraft {
  subject: string;
  body: string;
  source: "ai" | "template";
}

/** First sentence-ish of a blob, hard-capped, single line. */
function oneLine(text: string, max = 220): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const firstStop = flat.indexOf(". ");
  const candidate =
    firstStop > 40 && firstStop < max ? flat.slice(0, firstStop + 1) : flat;
  return candidate.length > max ? `${candidate.slice(0, max - 1).trimEnd()}…` : candidate;
}

export function draftSubject(count: number, dateISO: string): string {
  const date = formatDate(dateISO);
  return count === 0
    ? `D2OS Leadership Status Update — ${date} — no executive escalations`
    : `D2OS Leadership Status Update — ${date} — ${count} escalation${count === 1 ? "" : "s"} at executive visibility`;
}

export function composeTemplateDraft(
  details: Care3Detail[],
  authorName: string,
  now = new Date()
): EmailDraft {
  const nowISO = now.toISOString();
  const count = details.length;
  const lines: string[] = ["Team,", ""];

  if (count === 0) {
    lines.push(
      "No escalations at executive visibility this week. The Care 3 pipeline is clear; day-to-day escalations continue under normal Care 1/2 handling."
    );
  } else {
    lines.push(
      `${count} escalation${count === 1 ? "" : "s"} at executive visibility this week. Detail below, one per account.`
    );
    for (const d of details) {
      const e = d.escalation;
      const meta = [
        `Status: ${STATUS_LABELS[e.status]} (${e.tier?.label ?? e.tier_key})`,
        `CSM: ${e.owner?.name ?? "Unassigned"}`,
        `Opened: ${formatDate(e.opened_at)}`,
        e.target_resolution_date
          ? `Target: ${formatDate(e.target_resolution_date)}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ");
      const nextStep = d.latestNote ?? d.latestTouchpoint;
      lines.push(
        "",
        `${e.account_name} — ${oneLine(e.title, 120)}`,
        meta,
        `Impact: ${oneLine(e.description)}`,
        nextStep
          ? `Next step: ${oneLine(nextStep)}`
          : `Next step: No recent activity logged — ${e.owner?.name ?? "the assigned CSM"} to post an update.`
      );
    }
  }

  lines.push(
    "",
    "Full detail — including the leadership deck export — is in the D2OS Care Tracker.",
    "",
    "Thank you,",
    authorName
  );

  return {
    subject: draftSubject(count, nowISO),
    body: lines.join("\n"),
    source: "template",
  };
}

/**
 * Full-detail context blocks for AI generation — the same construction the
 * weekly executive summary prompt uses.
 */
export function buildAiContext(details: Care3Detail[]): string {
  return details
    .map((d) => {
      const e = d.escalation;
      const recentNotes = d.comments
        .slice(-5)
        .map((c) => `  - [${formatDate(c.created_at)}] ${c.author?.name}: ${c.body}`)
        .join("\n");
      return `### ${e.account_name} — ${e.title}
Tier: ${e.tier?.label ?? e.tier_key} | Status: ${STATUS_LABELS[e.status]} | CSM: ${e.owner?.name}
Opened: ${formatDate(e.opened_at)} | Target: ${formatDate(e.target_resolution_date)} | Elevated: ${e.elevated_at ? formatDate(e.elevated_at) : "not yet"}
Description: ${e.description}
Recent notes:
${recentNotes || "  (none)"}
Latest touchpoint: ${d.latestTouchpoint ?? "(none)"}`;
    })
    .join("\n\n");
}
