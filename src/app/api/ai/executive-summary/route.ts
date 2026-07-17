import { anthropic, AI_MODEL } from "@/lib/anthropic";
import { db } from "@/lib/supabase";
import { getComments, getEscalations, getTouchpoints, logAudit } from "@/lib/data";
import { requireMemberApi } from "@/lib/session";
import { formatDate, todayISO } from "@/lib/format";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/**
 * Auto-generate the weekly Care 3 executive summary: every active
 * executive-reporting escalation, condensed into a leadership-ready brief.
 */
export async function POST() {
  const { member, response } = await requireMemberApi();
  if (!member) return response;

  try {
    const escalations = (await getEscalations({ status: "active" })).filter(
      (e) => e.tier_key === "care_3" || e.executive_reporting
    );

    if (escalations.length === 0) {
      return Response.json({
        content:
          "**No active Care 3 / executive-reporting escalations this week.** Nothing requires leadership attention.",
        model: AI_MODEL,
      });
    }

    const sections = await Promise.all(
      escalations.map(async (e) => {
        const [comments, touchpoints] = await Promise.all([
          getComments(e.id),
          getTouchpoints(e.id),
        ]);
        const recentNotes = comments
          .slice(-5)
          .map((c) => `  - [${formatDate(c.created_at)}] ${c.author?.name}: ${c.body}`)
          .join("\n");
        const recentTouchpoints = touchpoints
          .slice(0, 3)
          .map((t) => `  - [${formatDate(t.touchpoint_date)}] ${t.notes}`)
          .join("\n");
        return `### ${e.account_name} — ${e.title}
Tier: ${e.tier?.label ?? e.tier_key} | Status: ${e.status} | CSM: ${e.owner?.name}
Opened: ${formatDate(e.opened_at)} | Target: ${formatDate(e.target_resolution_date)} | Elevated: ${e.elevated_at ? formatDate(e.elevated_at) : "not yet"}
Description: ${e.description}
Recent notes:
${recentNotes || "  (none)"}
Recent touchpoints:
${recentTouchpoints || "  (none)"}`;
      })
    );

    const result = await anthropic().messages.create({
      model: AI_MODEL,
      max_tokens: 12000,
      thinking: { type: "adaptive" },
      system: `You write the weekly executive escalation summary for WWT's Day 2 Operations (D2OS) team. The audience is Elena Vitkin (Sr. Manager, Day-2 Ops) and her leadership chain (Director and above) — assume they have 3 minutes.

Structure the output as markdown:
1. "## Executive Summary — Week of ${todayISO()}" followed by a 2-4 sentence overall read: how many escalations, overall trajectory, the single most important item.
2. "## Escalations" — one subsection per account ("### Account — one-line issue"), each with exactly:
   - **Status:** current state and trajectory (improving / stable / deteriorating)
   - **Impact:** business impact in plain terms
   - **Ask:** what, if anything, leadership needs to do — write "None this week" when nothing is needed
3. "## Watch Items" — anything trending toward needing executive attention (may be empty; omit the section if so).

Be factual, grounded only in the provided records, and direct. Never invent progress or commitments. Flag stale records (no recent notes/touchpoints) explicitly as "no recent activity logged".`,
      messages: [
        {
          role: "user",
          content: `Active Care 3 / executive-reporting escalations:\n\n${sections.join("\n\n")}`,
        },
      ],
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
      escalation_id: null,
      kind: "exec_summary",
      content: text,
      model: AI_MODEL,
      created_by: member.id,
    });
    await logAudit({ actor_id: member.id, action: "ai.exec_summary_generated" });

    return Response.json({ content: text, model: AI_MODEL });
  } catch (err) {
    console.error("executive summary failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Executive summary failed" },
      { status: 500 }
    );
  }
}
