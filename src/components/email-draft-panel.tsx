"use client";

import { useState } from "react";

/**
 * Leadership Status Update email draft. Draft ONLY — nothing is sent from
 * the app. The user copies the draft into Outlook (or opens a mailto:
 * handoff) after reviewing it.
 */

// Practical cross-client ceiling for a mailto: URL. Longer links get the
// body truncated with an explicit note instead of silently breaking.
const MAILTO_MAX_LENGTH = 1800;
const TRUNCATION_NOTE =
  "\n\n[Content truncated for the email link — use Copy to clipboard for the full update.]";

interface Draft {
  subject: string;
  body: string;
  source: "ai" | "template";
}

export function buildMailtoHref(
  to: string,
  subject: string,
  body: string
): { href: string; truncated: boolean } {
  const make = (b: string) =>
    `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(b)}`;

  let href = make(body);
  if (href.length <= MAILTO_MAX_LENGTH) return { href, truncated: false };

  // Trim the body until the encoded URL fits, then append the note.
  let keep = body.length;
  while (keep > 0) {
    href = make(`${body.slice(0, keep).trimEnd()}${TRUNCATION_NOTE}`);
    if (href.length <= MAILTO_MAX_LENGTH) return { href, truncated: true };
    // Encoded chars are at most 3 bytes; overshoot to converge quickly.
    keep -= Math.max(8, Math.ceil((href.length - MAILTO_MAX_LENGTH) / 3));
  }
  return { href: make(TRUNCATION_NOTE.trim()), truncated: true };
}

export function EmailDraftPanel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [to, setTo] = useState(""); // intentionally blank — recipients vary
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/email-draft", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Draft generation failed");
      setDraft(data);
      setSubject(data.subject);
      setBody(data.body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draft generation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const mailto = draft ? buildMailtoHref(to, subject, body) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800 disabled:opacity-60"
        >
          {loading
            ? "Drafting…"
            : draft
              ? "Regenerate draft"
              : "Draft Leadership Status Update"}
        </button>
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          Draft only — review before sending. This does not send email
          automatically.
        </p>
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {draft && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="draft-to"
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                To (optional — fills the Outlook draft)
              </label>
              <input
                id="draft-to"
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="Add recipients in Outlook, or type them here"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="draft-subject"
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Subject
              </label>
              <input
                id="draft-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="draft-body"
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Body (editable)
            </label>
            <textarea
              id="draft-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={Math.min(22, Math.max(8, body.split("\n").length + 1))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-slate-800"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={copy}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {copied ? "Copied ✓" : "Copy to clipboard"}
            </button>
            {mailto && (
              <a
                href={mailto.href}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Open in Outlook
              </a>
            )}
            {mailto?.truncated && (
              <p className="text-xs text-amber-700">
                The email link carries a shortened body (mailto links have a
                length limit) — use Copy to clipboard for the full update.
              </p>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            {draft.source === "ai"
              ? "Phrased with AI from the live escalation records — same data as the executive summary and PowerPoint deck."
              : "Built directly from the live escalation records (AI not configured) — same data as the executive summary and PowerPoint deck."}
          </p>
        </div>
      )}

      {!draft && !loading && (
        <p className="text-xs text-slate-400">
          Drafts a scannable status email from the active Care 3 /
          executive-reporting escalations: a summary count, then one paragraph
          per account with status, impact, and next step. Works with or
          without AI configured.
        </p>
      )}
    </div>
  );
}
