import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, AI_MODEL } from "@/lib/anthropic";
import { getSettings, getTiers, getTypes } from "@/lib/data";
import { requireMemberApi } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Suggest a care tier (and, when the type dimension is enabled, an
 * escalation type) from the escalation description.
 */
export async function POST(request: Request) {
  const { member, response } = await requireMemberApi();
  if (!member) return response;

  const body = await request.json().catch(() => null);
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  if (!description) {
    return Response.json({ error: "description is required" }, { status: 400 });
  }

  try {
    const [settings, tiers, types] = await Promise.all([
      getSettings(),
      getTiers(),
      getTypes(),
    ]);

    const tierKeys = tiers.map((t) => t.key) as [string, ...string[]];
    const typeKeys = types.map((t) => t.key) as [string, ...string[]];

    const schema = z.object({
      tier_key: z.enum(tierKeys),
      type_key: settings.types_enabled ? z.enum(typeKeys).nullable() : z.null(),
      rationale: z.string(),
    });

    const tierGuide = tiers
      .map((t) => `- ${t.key} (${t.label}): ${t.description ?? ""} Urgency: ${t.urgency ?? "n/a"}.`)
      .join("\n");
    const typeGuide = settings.types_enabled
      ? `\nEscalation types:\n${types.map((t) => `- ${t.key} (${t.label}): ${t.description ?? ""}`).join("\n")}`
      : "";

    const result = await anthropic().messages.parse({
      model: AI_MODEL,
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      system: `You classify customer escalations for WWT's Day 2 Operations CSM team using their 3-Tier Care Model.

Care tiers:
${tierGuide}
${typeGuide}

Pick the single best tier${settings.types_enabled ? " and type (or null if none fits)" : ""} for the escalation description, with a one-sentence rationale a CSM can sanity-check. When in doubt between two tiers, prefer the lower tier — elevation is an explicit human decision.`,
      messages: [{ role: "user", content: `Escalation description:\n\n${description}` }],
      output_config: { format: zodOutputFormat(schema) },
    });

    const parsed = result.parsed_output;
    if (!parsed) {
      return Response.json({ error: "Classification failed to parse." }, { status: 502 });
    }

    const type = types.find((t) => t.key === parsed.type_key);
    return Response.json({
      tier_key: parsed.tier_key,
      type_key: parsed.type_key ?? null,
      type_label: type?.label ?? null,
      rationale: parsed.rationale,
    });
  } catch (err) {
    console.error("classify failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Classification failed" },
      { status: 500 }
    );
  }
}
