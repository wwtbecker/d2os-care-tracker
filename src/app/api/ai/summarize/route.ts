import { anthropic, aiEnabled, AI_MODEL, AI_UNAVAILABLE_MESSAGE } from "@/lib/anthropic";
import { db } from "@/lib/supabase";
import { getComments, getEscalation, getTouchpoints, logAudit } from "@/lib/data";
import { requireMemberApi } from "@/lib/session";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Summarize an escalation (record + notes + touchpoints) in the
 * Situation–Problem–Impact–Need–Action format used for leadership readouts.
 * The result is persisted to ai_outputs so the latest summary is always
 * visible on the escalation page.
 */
export async function POST(request: Request) {
  const { member, response } = await requireMemberApi();
  if (!member) return response;
  if (!aiEnabled()) {
    return Response.json({ error: AI_UNAVAILABLE_MESSAGE }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const escalationId = typeof body?.escalationId === "string" ? body.escalationId : "";
  if (!escalationId) {
    return Response.json({ error: "escalationId is required" }, { status: 400 });
  }

  try {
    const escalation = await getEscalation(escalationId);
    if (!escalation) {
      return Response.json({ error: "Escalation not found" }, { status: 404 });
    }
    const [comments, touchpoints] = await Promise.all([
      getComments(escalationId),
      getTouchpoints(escalationId),
    ]);

    const notesBlock = comments
      .map((c) => `- [${formatDate(c.created_at)}] ${c.author?.name ?? "Unknown"}: ${c.body}`)
      .join("\n");
    const touchpointBlock = touchpoints
      .map(
        (t) =>
          `- [${formatDate(t.touchpoint_date)}] ${t.notes}${t.action_items ? `\n  Action items: ${t.action_items}` : ""}`
      )
      .join("\n");

    const context = `Account: ${escalation.account_name}
Title: ${escalation.title}
Tier: ${escalation.tier?.label ?? escalation.tier_key}${escalation.type ? ` / ${escalation.type.label}` : ""}
Status: ${escalation.status}
Owner (CSM): ${escalation.owner?.name ?? "Unknown"}
Opened: ${formatDate(escalation.opened_at)}
Target resolution: ${formatDate(escalation.target_resolution_date)}

Description:
${escalation.description}

Team notes:
${notesBlock || "(none)"}

Cadence touchpoints:
${touchpointBlock || "(none)"}`;

    const result = await anthropic().messages.create({
      model: AI_MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      system: `You write escalation summaries for WWT's Day 2 Operations CSM team, in the exact Situation-Problem-Impact-Need-Action (SPINA) format their leadership expects.

Output format — exactly these five sections, each as "**Header:** one to three sentences":
**Situation:** current state and context of the engagement
**Problem:** the specific issue driving the escalation
**Impact:** business/customer impact, quantified where the notes allow
**Need:** what is required to move forward (from WWT, the customer, or leadership)
**Action:** what is being done now and what happens next, with owners where known

Be factual and grounded only in the provided record — never invent status, dates, or commitments. Write for a director-level reader in plain language. No preamble, no closing remarks.`,
      messages: [{ role: "user", content: context }],
    });

    const text = result.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (!text) {
      return Response.json({ error: "The model returned no summary." }, { status: 502 });
    }

    await db().from("ai_outputs").insert({
      escalation_id: escalationId,
      kind: "spina_summary",
      content: text,
      model: AI_MODEL,
      created_by: member.id,
    });
    await logAudit({
      actor_id: member.id,
      action: "ai.summary_generated",
      escalation_id: escalationId,
    });

    return Response.json({ content: text, model: AI_MODEL });
  } catch (err) {
    console.error("summarize failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Summarization failed" },
      { status: 500 }
    );
  }
}
