"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * AI panel on the escalation detail page: generates a
 * Situation–Problem–Impact–Need–Action summary from the record, its notes,
 * and cadence touchpoints. Results are persisted server-side (ai_outputs).
 */
export function AiSummaryPanel({
  escalationId,
  latest,
  aiAvailable,
}: {
  escalationId: string;
  latest: { content: string; created_at: string; model: string } | null;
  /** False when ANTHROPIC_API_KEY is not configured — the generate button
   * degrades to an explanatory note instead of a failing request. */
  aiAvailable: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escalationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Summarization failed");
      setFresh(data.content);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Summarization failed.");
    } finally {
      setLoading(false);
    }
  }

  const content = fresh ?? latest?.content ?? null;

  if (!aiAvailable) {
    return (
      <div className="space-y-3">
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          ✦ AI features unavailable — API key not configured. SPINA summaries
          will work once ANTHROPIC_API_KEY is set.
        </p>
        {content && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <SpinaContent content={content} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={generate}
        disabled={loading}
        className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {loading
          ? "Summarizing…"
          : content
            ? "✦ Regenerate SPINA summary"
            : "✦ Generate SPINA summary"}
      </button>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}
      {content && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <SpinaContent content={content} />
          {!fresh && latest && (
            <p className="mt-3 text-[11px] text-slate-400">
              Generated {new Date(latest.created_at).toLocaleString()} · {latest.model}
            </p>
          )}
        </div>
      )}
      {!content && (
        <p className="text-xs text-slate-400">
          Distills the description, team notes, and touchpoints into the
          Situation · Problem · Impact · Need · Action format used for
          leadership readouts.
        </p>
      )}
    </div>
  );
}

/** Lightweight renderer for the **Header:** body markdown the summary uses. */
function SpinaContent({ content }: { content: string }) {
  const lines = content.split("\n").filter((l) => l.trim() !== "");
  return (
    <div className="space-y-2 text-sm text-slate-700">
      {lines.map((line, i) => {
        const match = line.match(/^\*\*(.+?):?\*\*:?\s*(.*)$/);
        if (match) {
          return (
            <p key={i}>
              <span className="font-semibold text-slate-900">{match[1]}: </span>
              {match[2]}
            </p>
          );
        }
        return <p key={i}>{line.replace(/^[-•]\s*/, "• ")}</p>;
      })}
    </div>
  );
}
