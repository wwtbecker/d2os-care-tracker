import PptxGenJS from "pptxgenjs";
import { db } from "@/lib/supabase";
import { getEscalations, getTiers } from "@/lib/data";
import { buildSnapshot } from "@/lib/reporting";
import { requireMemberApi } from "@/lib/session";
import { formatDate } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// WWT brand palette. Light Blue on white is only accessible at large/bold
// sizes, so it is reserved for bold headlines >= 18pt; body copy stays #262626.
const WWT_LIGHT_BLUE = "0086EA";
const WWT_DARK_BLUE = "1C0087";
const WWT_RED = "EE282A"; // accents only — never a dominant background
const WWT_NAVY = "1D1E48";
const BODY = "262626";
const WHITE = "FFFFFF";
const TABLE_BORDER = "D9D9D9";
// Roobert isn't available server-side, so Arial stands in per brand fallback.
const FONT = "Arial";

/** Thin Light Blue rule along the bottom of interior slides as a brand accent. */
function addBrandFooter(slide: PptxGenJS.Slide) {
  slide.addShape("rect", {
    x: 0, y: 7.42, w: 13.33, h: 0.08, fill: { color: WWT_LIGHT_BLUE },
  });
}

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
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT };
  const today = formatDate(new Date().toISOString());

  // --- Title slide: dark background, white headline, Light Blue subtitle ---
  const title = pptx.addSlide();
  title.background = { color: WWT_DARK_BLUE };
  // Text placeholder until the official WWT logo asset is exported.
  title.addText(
    [
      { text: "WWT", options: { bold: true, color: WHITE, breakLine: false } },
      { text: "  |  ", options: { color: WWT_LIGHT_BLUE, breakLine: false } },
      { text: "D2OS Care Tracker", options: { color: WHITE } },
    ],
    { x: 0.6, y: 0.35, w: 6, h: 0.4, fontSize: 14, fontFace: FONT }
  );
  title.addText("D2OS Customer Escalations", {
    x: 0.8, y: 2.4, w: 11.7, h: 1.0,
    fontSize: 40, bold: true, color: WHITE, fontFace: FONT,
  });
  title.addText("Leadership Review — Day 2 Operations CSM Team", {
    x: 0.8, y: 3.4, w: 11.7, h: 0.6,
    fontSize: 20, color: WWT_LIGHT_BLUE, fontFace: FONT,
  });
  title.addText(
    `${today}  ·  ${snapshot.totalActive} active escalations  ·  ${care3.length} at executive visibility`,
    { x: 0.8, y: 4.2, w: 11.7, h: 0.5, fontSize: 14, color: WHITE, fontFace: FONT }
  );

  // --- Snapshot slide ---
  const snap = pptx.addSlide();
  snap.background = { color: WHITE };
  snap.addText("Weekly Snapshot", {
    x: 0.6, y: 0.4, w: 12, h: 0.6,
    fontSize: 26, bold: true, color: WWT_LIGHT_BLUE, fontFace: FONT,
  });
  addBrandFooter(snap);

  const tierRows: PptxGenJS.TableRow[] = [
    [
      { text: "Care Tier", options: { bold: true, color: WHITE, fill: { color: WWT_DARK_BLUE } } },
      { text: "Open", options: { bold: true, color: WHITE, fill: { color: WWT_DARK_BLUE } } },
    ],
    ...snapshot.byTier.map((row): PptxGenJS.TableRow => [
      { text: row.label, options: { color: BODY } },
      { text: String(row.count), options: { color: BODY } },
    ]),
  ];
  snap.addTable(tierRows, {
    x: 0.6, y: 1.2, w: 3.6, fontSize: 14, rowH: 0.4, fontFace: FONT,
    border: { type: "solid", color: TABLE_BORDER, pt: 1 },
    fill: { color: WHITE },
  });

  const csmRows: PptxGenJS.TableRow[] = [
    [
      { text: "CSM", options: { bold: true, color: WHITE, fill: { color: WWT_DARK_BLUE } } },
      { text: "Open", options: { bold: true, color: WHITE, fill: { color: WWT_DARK_BLUE } } },
    ],
    ...snapshot.byCsm.map((row): PptxGenJS.TableRow => [
      { text: row.label, options: { color: BODY } },
      { text: String(row.count), options: { color: BODY } },
    ]),
  ];
  snap.addTable(csmRows, {
    x: 4.7, y: 1.2, w: 3.9, fontSize: 14, rowH: 0.4, fontFace: FONT,
    border: { type: "solid", color: TABLE_BORDER, pt: 1 },
    fill: { color: WHITE },
  });

  const accountRows: PptxGenJS.TableRow[] = [
    [
      { text: "Account", options: { bold: true, color: WHITE, fill: { color: WWT_DARK_BLUE } } },
      { text: "Open", options: { bold: true, color: WHITE, fill: { color: WWT_DARK_BLUE } } },
    ],
    ...snapshot.byAccount.slice(0, 10).map((row): PptxGenJS.TableRow => [
      { text: row.label, options: { color: BODY } },
      { text: String(row.count), options: { color: BODY } },
    ]),
  ];
  snap.addTable(accountRows, {
    x: 9.0, y: 1.2, w: 3.7, fontSize: 14, rowH: 0.4, fontFace: FONT,
    border: { type: "solid", color: TABLE_BORDER, pt: 1 },
    fill: { color: WHITE },
  });

  // --- One slide per Care 3 escalation ---
  for (const e of care3) {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addBrandFooter(slide);
    slide.addText(e.account_name, {
      x: 0.6, y: 0.4, w: 12, h: 0.65,
      fontSize: 26, bold: true, color: WWT_LIGHT_BLUE, fontFace: FONT,
    });
    // Short Bright Red underline as an escalation accent.
    slide.addShape("rect", {
      x: 0.62, y: 1.1, w: 0.7, h: 0.05, fill: { color: WWT_RED },
    });
    slide.addText(e.title, {
      x: 0.6, y: 1.25, w: 12, h: 0.45, fontSize: 15, color: BODY, fontFace: FONT,
    });

    const meta = [
      `Status: ${STATUS_LABELS[e.status]}`,
      `CSM: ${e.owner?.name ?? "—"}`,
      `Opened: ${formatDate(e.opened_at)}`,
      `Target: ${formatDate(e.target_resolution_date)}`,
      `Elevated: ${e.elevated_at ? formatDate(e.elevated_at) : "Not yet"}`,
    ].join("     ");
    slide.addText(meta, {
      x: 0.6, y: 1.75, w: 12.1, h: 0.4, fontSize: 12, color: WWT_NAVY, fontFace: FONT,
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
            options: { bold: true, color: WWT_DARK_BLUE, breakLine: false },
          });
          runs.push({ text: line.body, options: { color: BODY, breakLine: true } });
        } else {
          runs.push({ text: line.body, options: { color: BODY, breakLine: true } });
        }
      }
      slide.addText(runs, {
        x: 0.6, y: 2.3, w: 12.1, h: 4.9, fontSize: 13, fontFace: FONT,
        valign: "top", lineSpacingMultiple: 1.2, margin: 12,
      });
    } else {
      slide.addText(
        e.description.length > 1200
          ? `${e.description.slice(0, 1200)}…`
          : e.description,
        {
          x: 0.6, y: 2.3, w: 12.1, h: 4.9, fontSize: 13, color: BODY, fontFace: FONT,
          valign: "top", lineSpacingMultiple: 1.2, margin: 12,
        }
      );
    }
  }

  if (care3.length === 0) {
    const none = pptx.addSlide();
    none.background = { color: WHITE };
    addBrandFooter(none);
    none.addText("No active Care 3 / executive-reporting escalations.", {
      x: 0.8, y: 3.2, w: 11.7, h: 0.8,
      fontSize: 20, bold: true, color: WWT_LIGHT_BLUE, fontFace: FONT,
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
