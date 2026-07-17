"use client";

import { useState } from "react";

/**
 * Weekly Care 3 executive summary generator. Results are persisted
 * server-side; the latest stored summary is passed in for display.
 */
export function ExecSummaryPanel({
  latest,
}: {
  latest: { content: string; created_at: string } | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(latest?.content ?? null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(
    latest?.created_at ?? null
  );
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/executive-summary", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setContent(data.content);
      setGeneratedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800 disabled:opacity-60"
        >
          {loading ? "Generating…" : "✦ Generate weekly Care 3 executive summary"}
        </button>
        {content && (
          <button
            onClick={copy}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {copied ? "Copied ✓" : "Copy markdown"}
          </button>
        )}
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {content && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <MarkdownLite content={content} />
          {generatedAt && (
            <p className="mt-4 text-[11px] text-slate-400">
              Generated {new Date(generatedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
      {!content && !loading && (
        <p className="text-xs text-slate-400">
          Builds a leadership-ready brief from every active Care 3 /
          executive-reporting escalation: status, impact, and asks per account.
        </p>
      )}
    </div>
  );
}

/** Minimal markdown renderer for headings, bold spans, and bullets. */
function MarkdownLite({ content }: { content: string }) {
  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  return (
    <div className="space-y-2 text-sm leading-relaxed text-slate-700">
      {content.split("\n").map((line, i) => {
        const trimmed = line.trim();
        if (trimmed === "") return null;
        if (trimmed.startsWith("### "))
          return (
            <h4 key={i} className="pt-2 text-base font-semibold text-slate-900">
              {renderInline(trimmed.slice(4))}
            </h4>
          );
        if (trimmed.startsWith("## "))
          return (
            <h3 key={i} className="pt-3 text-lg font-semibold text-slate-900">
              {renderInline(trimmed.slice(3))}
            </h3>
          );
        if (trimmed.startsWith("- "))
          return (
            <p key={i} className="pl-4">
              • {renderInline(trimmed.slice(2))}
            </p>
          );
        return <p key={i}>{renderInline(trimmed)}</p>;
      })}
    </div>
  );
}
