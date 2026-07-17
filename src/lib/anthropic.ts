import Anthropic from "@anthropic-ai/sdk";

export const AI_MODEL = "claude-opus-4-8";

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
