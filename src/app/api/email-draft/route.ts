import { anthropic, aiEnabled, AI_MODEL } from "@/lib/anthropic";
import {
  buildAiContext,
  composeTemplateDraft,
  draftSubject,
  getExecutiveDetails,
  getExecutiveEscalations,
  type EmailDraft,
} from "@/lib/care3";
import { logAudit } from "@/lib/data";
import { requireMemberApi } from "@/lib/session";
import { todayISO } from "@/lib/format";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Leadership Status Update email DRAFT. Draft only — the app never sends
 * email; the client offers copy-to-clipboard and a mailto: handoff.
 *
 * Uses the same escalation selection as the weekly executive summary and
 * the PowerPoint export. With ANTHROPIC_API_KEY configured the body is
 * AI-phrased; without it (or if the model call fails) it falls back to a
 * template built directly from the records, so the feature always works.
 */
export async function POST() {
  const { member, response } = await requireMemberApi();
  if (!member) return response;

  try {
    const escalations = await getExecutiveEscalations();
    const details = await getExecutiveDetails(escalations);
    const template = composeTemplateDraft(details, member.name);

    let draft: EmailDraft = template;
    if (aiEnabled() && details.length > 0) {
      try {
        const result = await anthropic().messages.create({
          model: AI_MODEL,
          max_tokens: 4000,
          system: `You draft the weekly "Leadership Status Update" email body for WWT's Day 2 Operations (D2OS) team. Audience: senior leadership skimming on a phone. Follow WWT tone: purposeful, confident, beautifully simple — short sentences, active voice, no jargon, no hype.

Output PLAIN TEXT only (no markdown, no asterisks, no headings syntax). Structure exactly:
1. "Team," greeting line, then a blank line.
2. One summary line: "<N> escalation(s) at executive visibility this week." plus at most one more sentence on the overall picture.
3. One short paragraph per escalation, separated by blank lines, each covering on its own lines: "<Account> — <one-line issue>", a status line (status, tier, CSM, opened/target dates), "Impact: <one line, business terms>", and "Next step: <the concrete next action or leadership ask — 'None this week' if nothing is needed>".
4. Closing: a pointer that full detail lives in the D2OS Care Tracker, then "Thank you," and the sender's name: ${member.name}.

Ground every statement in the provided records. Never invent progress, dates, or commitments. If a record shows no recent activity, say so plainly.`,
          messages: [
            {
              role: "user",
              content: `Active Care 3 / executive-reporting escalations (${details.length}):\n\n${buildAiContext(details)}`,
            },
          ],
        });
        const text = result.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("\n")
          .trim();
        if (text) {
          draft = {
            subject: draftSubject(details.length, todayISO()),
            body: text,
            source: "ai",
          };
        }
      } catch (err) {
        // AI unreachable or errored — the template draft still goes out.
        console.error("email draft AI generation failed, using template:", err);
      }
    }

    await logAudit({
      actor_id: member.id,
      action: "email_draft.generated",
      details: { escalations: details.length, source: draft.source },
    });
    return Response.json(draft);
  } catch (err) {
    console.error("email draft failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Email draft failed" },
      { status: 500 }
    );
  }
}
