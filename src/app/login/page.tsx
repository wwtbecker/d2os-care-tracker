import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { pocMode } from "@/lib/auth-mode";
import { getTeamMembers } from "@/lib/data";
import { devBypassEmail, devBypassEnabled } from "@/lib/dev-bypass";
import type { TeamMember } from "@/lib/types";

export const metadata = { title: "Sign in" };

export default async function LoginPage(props: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const searchParams = await props.searchParams;
  const session = await auth();
  if (session?.user) redirect("/");

  let roster: TeamMember[] = [];
  let rosterError: string | null = null;
  if (pocMode()) {
    try {
      roster = await getTeamMembers();
    } catch {
      rosterError =
        "Couldn't load the team roster — check that SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local and that the database is reachable.";
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-10 shadow-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-xl font-bold text-white">
            D2
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">
            D2OS Care Tracker
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Customer escalation tracking for the WWT Day 2 Operations CSM team
          </p>
        </div>

        {searchParams.error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Sign-in failed ({searchParams.error}). Please try again or contact
            the team administrator.
          </p>
        )}

        {pocMode() ? (
          <>
            {rosterError ? (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {rosterError}
              </p>
            ) : (
              <form
                action={async (formData: FormData) => {
                  "use server";
                  await signIn("roster", {
                    memberId: formData.get("memberId"),
                    redirectTo: searchParams.callbackUrl ?? "/",
                  });
                }}
                className="space-y-4"
              >
                <label
                  htmlFor="memberId"
                  className="block text-sm font-medium text-slate-700"
                >
                  Who&apos;s testing today?
                </label>
                <select
                  id="memberId"
                  name="memberId"
                  required
                  defaultValue=""
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
                >
                  <option value="" disabled>
                    Select your name…
                  </option>
                  {roster.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.role === "admin" ? "Admin" : "CSM"}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-ink-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink-800"
                >
                  Continue
                </button>
              </form>
            )}
            <p className="mt-6 text-center text-xs text-slate-400">
              Proof-of-concept build: pick your name to try the workflow as
              yourself. All accounts and escalations in here are fictional
              test data.
            </p>
          </>
        ) : (
          <>
            <form
              action={async () => {
                "use server";
                await signIn("okta", {
                  redirectTo: searchParams.callbackUrl ?? "/",
                });
              }}
            >
              <button
                type="submit"
                className="w-full rounded-lg bg-ink-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink-800"
              >
                Sign in with WWT SSO (Okta)
              </button>
            </form>

            {devBypassEnabled() && (
              <form
                className="mt-4"
                action={async () => {
                  "use server";
                  await signIn("dev-bypass", {
                    redirectTo: searchParams.callbackUrl ?? "/",
                  });
                }}
              >
                <button
                  type="submit"
                  className="w-full rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
                >
                  ⚠ Dev sign-in as {devBypassEmail()} (no Okta)
                </button>
                <p className="mt-2 text-center text-[11px] text-amber-600">
                  DEV_BYPASS_AUTH is on — local testing only. This button
                  cannot exist in a production build.
                </p>
              </form>
            )}

            <p className="mt-6 text-center text-xs text-slate-400">
              Access is limited to the D2OS CSM team roster. This system
              contains live client escalation data — handle accordingly.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
