import PptxGenJS from "pptxgenjs";
import { db } from "@/lib/supabase";
import { getEscalations, getTiers } from "@/lib/data";
import { buildSnapshot } from "@/lib/reporting";
import { requireMemberApi } from "@/lib/session";
import { formatDate } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const INK = "1C2A45";
const MUTED = "64748B";
const LIGHT = "F4F6FA";

/**
 * PowerPoint export for leadership reviews: a summary slide plus one slide
 * per Care 3 / executive-reporting escalation (including the latest SPINA
 * summary when one has been generated).
 */
export async function GET() {
  const { member, response } = await requireMemberApi();
  if (!member) return response;

  const [tiers, active] = await Promise.all([
    getTiers(),
    getEscalations({ status: "active" }),
  ]);
  const snapshot = buildSnapshot(active, tiers);
  const care3 = active.filter(
    (e) => e.tier_key === "care_3" || e.executive_reporting
  );

  // Latest SPINA summary per Care 3 escalation.
  const summaries = new Map<string, string>();
  if (care3.length > 0) {
    const { data } = await db()
      .from("ai_outputs")
      .select("escalation_id, content, created_at")
      .eq("kind", "spina_summary")
      .in("escalation_id", care3.map((e) => e.id))
      .order("created_at", { ascending: false });
    for (const row of data ?? []) {
      if (row.escalation_id && !summaries.has(row.escalation_id)) {
        summaries.set(row.escalation_id, row.content);
      }
    }
  }

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });
  pptx.layout = "WIDE";
  const today = formatDate(new Date().toISOString());

  // --- Title slide ---
  const title = pptx.addSlide();
  title.background = { color: INK };
  title.addText("D2OS Customer Escalations", {
    x: 0.8, y: 2.4, w: 11.7, h: 1.0,
    fontSize: 40, bold: true, color: "FFFFFF",
  });
  title.addText("Leadership Review — Day 2 Operations CSM Team", {
    x: 0.8, y: 3.4, w: 11.7, h: 0.6,
    fontSize: 20, color: "C7D2E5",
  });
  title.addText(
    `${today}  ·  ${snapshot.totalActive} active escalations  ·  ${care3.length} at executive visibility`,
    { x: 0.8, y: 4.2, w: 11.7, h: 0.5, fontSize: 14, color: "8CA3C7" }
  );

  // --- Snapshot slide ---
  const snap = pptx.addSlide();
  snap.addText("Weekly Snapshot", {
    x: 0.6, y: 0.4, w: 12, h: 0.6, fontSize: 26, bold: true, color: INK,
  });

  const tierRows: PptxGenJS.TableRow[] = [
    [
      { text: "Care Tier", options: { bold: true, color: "FFFFFF", fill: { color: INK } } },
      { text: "Open", options: { bold: true, color: "FFFFFF", fill: { color: INK } } },
    ],
    ...snapshot.byTier.map((row): PptxGenJS.TableRow => [
      { text: row.label, options: { color: INK } },
      { text: String(row.count), options: { color: INK } },
    ]),
  ];
  snap.addTable(tierRows, {
    x: 0.6, y: 1.2, w: 3.6, fontSize: 14, rowH: 0.4,
    border: { type: "solid", color: "DDE3EE", pt: 1 },
    fill: { color: "FFFFFF" },
  });

  const csmRows: PptxGenJS.TableRow[] = [
    [
      { text: "CSM", options: { bold: true, color: "FFFFFF", fill: { color: INK } } },
      { text: "Open", options: { bold: true, color: "FFFFFF", fill: { color: INK } } },
    ],
    ...snapshot.byCsm.map((row): PptxGenJS.TableRow => [
      { text: row.label, options: { color: INK } },
      { text: String(row.count), options: { color: INK } },
    ]),
  ];
  snap.addTable(csmRows, {
    x: 4.7, y: 1.2, w: 3.9, fontSize: 14, rowH: 0.4,
    border: { type: "solid", color: "DDE3EE", pt: 1 },
    fill: { color: "FFFFFF" },
  });

  const accountRows: PptxGenJS.TableRow[] = [
    [
      { text: "Account", options: { bold: true, color: "FFFFFF", fill: { color: INK } } },
      { text: "Open", options: { bold: true, color: "FFFFFF", fill: { color: INK } } },
    ],
    ...snapshot.byAccount.slice(0, 10).map((row): PptxGenJS.TableRow => [
      { text: row.label, options: { color: INK } },
      { text: String(row.count), options: { color: INK } },
    ]),
  ];
  snap.addTable(accountRows, {
    x: 9.0, y: 1.2, w: 3.7, fontSize: 14, rowH: 0.4,
    border: { type: "solid", color: "DDE3EE", pt: 1 },
    fill: { color: "FFFFFF" },
  });

  // --- One slide per Care 3 escalation ---
  for (const e of care3) {
    const slide = pptx.addSlide();
    slide.addShape("rect", {
      x: 0, y: 0, w: 13.33, h: 1.3, fill: { color: "9F1239" },
    });
    slide.addText(e.account_name, {
      x: 0.6, y: 0.15, w: 12, h: 0.6, fontSize: 24, bold: true, color: "FFFFFF",
    });
    slide.addText(e.title, {
      x: 0.6, y: 0.72, w: 12, h: 0.45, fontSize: 14, color: "FBD5DF",
    });

    const meta = [
      `Status: ${STATUS_LABELS[e.status]}`,
      `CSM: ${e.owner?.name ?? "—"}`,
      `Opened: ${formatDate(e.opened_at)}`,
      `Target: ${formatDate(e.target_resolution_date)}`,
      `Elevated: ${e.elevated_at ? formatDate(e.elevated_at) : "Not yet"}`,
    ].join("     ");
    slide.addText(meta, {
      x: 0.6, y: 1.5, w: 12.1, h: 0.4, fontSize: 12, color: MUTED,
    });

    const summary = summaries.get(e.id);
    if (summary) {
      // SPINA summary lines: "**Header:** body"
      const lines = summary
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const m = l.match(/^\*\*(.+?):?\*\*:?\s*(.*)$/);
          return m ? { header: m[1], body: m[2] } : { header: null, body: l };
        });
      const runs: PptxGenJS.TextProps[] = [];
      for (const line of lines) {
        if (line.header) {
          runs.push({
            text: `${line.header}: `,
            options: { bold: true, color: INK, breakLine: false },
          });
          runs.push({ text: line.body, options: { color: "334155", breakLine: true } });
        } else {
          runs.push({ text: line.body, options: { color: "334155", breakLine: true } });
        }
      }
      slide.addText(runs, {
        x: 0.6, y: 2.1, w: 12.1, h: 4.9, fontSize: 13,
        fill: { color: LIGHT }, valign: "top", lineSpacingMultiple: 1.2,
        margin: 12,
      });
    } else {
      slide.addText(
        e.description.length > 1200
          ? `${e.description.slice(0, 1200)}…`
          : e.description,
        {
          x: 0.6, y: 2.1, w: 12.1, h: 4.9, fontSize: 13, color: "334155",
          fill: { color: LIGHT }, valign: "top", lineSpacingMultiple: 1.2,
          margin: 12,
        }
      );
    }
  }

  if (care3.length === 0) {
    const none = pptx.addSlide();
    none.addText("No active Care 3 / executive-reporting escalations.", {
      x: 0.8, y: 3.2, w: 11.7, h: 0.8, fontSize: 20, color: MUTED, align: "center",
    });
  }

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  const date = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="d2os-care3-leadership-${date}.pptx"`,
    },
  });
}
