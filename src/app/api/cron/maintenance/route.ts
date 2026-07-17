import { runMaintenance } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * Daily maintenance: auto-archive resolved escalations past the retention
 * window and create Care 2 "touchpoint due" notifications. Wired to Vercel
 * Cron (vercel.json); the same logic also runs opportunistically on
 * dashboard loads, so the app degrades gracefully without a scheduler.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get("authorization");
    if (header !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runMaintenance();
    return Response.json({ ok: true, ...result });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Maintenance failed" },
      { status: 500 }
    );
  }
}
