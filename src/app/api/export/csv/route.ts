import { getEscalations } from "@/lib/data";
import { requireMemberApi } from "@/lib/session";
import { STATUS_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

/**
 * CSV export for leadership syncs and offline analysis.
 * Scopes: active (default) | all | care3
 */
export async function GET(request: Request) {
  const { member, response } = await requireMemberApi();
  if (!member) return response;

  const scope = new URL(request.url).searchParams.get("scope") ?? "active";
  const escalations =
    scope === "all"
      ? await getEscalations({ status: "all" })
      : scope === "care3"
        ? (await getEscalations({ status: "active" })).filter(
            (e) => e.tier_key === "care_3" || e.executive_reporting
          )
        : await getEscalations({ status: "active" });

  const header = [
    "Account",
    "Title",
    "Tier",
    "Type",
    "Status",
    "CSM Owner",
    "Opened",
    "Target Resolution",
    "Resolved",
    "Executive Reporting",
    "Elevated At",
    "Next Cadence",
    "Description",
  ];

  const rows = escalations.map((e) => [
    e.account_name,
    e.title,
    e.tier?.label ?? e.tier_key,
    e.type?.label ?? "",
    STATUS_LABELS[e.status],
    e.owner?.name ?? "",
    e.opened_at,
    e.target_resolution_date ?? "",
    e.resolved_at ? e.resolved_at.slice(0, 10) : "",
    e.executive_reporting ? "Yes" : "No",
    e.elevated_at ? e.elevated_at.slice(0, 10) : "",
    e.next_cadence_date ?? "",
    e.description,
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\r\n");

  const date = new Date().toISOString().slice(0, 10);
  // UTF-8 BOM so Excel opens the file with correct encoding.
  return new Response("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="d2os-escalations-${scope}-${date}.csv"`,
    },
  });
}
