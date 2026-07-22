import Anthropic from "@anthropic-ai/sdk";

export const AI_MODEL = "claude-opus-4-8";

export const AI_UNAVAILABLE_MESSAGE =
  "AI features unavailable — ANTHROPIC_API_KEY is not configured. The rest of the app works normally.";

/**
 * Whether AI features can run at all. The key is still pending from IT, so
 * every AI surface must degrade to a clear "not configured" state instead
 * of erroring when this is false.
 */
export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (client) return client;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "AI features are not configured. Set ANTHROPIC_API_KEY in the environment."
    );
  }
  client = new Anthropic();
  return client;
}
