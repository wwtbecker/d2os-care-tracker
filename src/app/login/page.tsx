import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export const metadata = { title: "Sign in" };

export default async function LoginPage(props: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const searchParams = await props.searchParams;
  const session = await auth();
  if (session?.user) redirect("/");

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

        <p className="mt-6 text-center text-xs text-slate-400">
          Access is limited to the D2OS CSM team roster. This system contains
          live client escalation data — handle accordingly.
        </p>
      </div>
    </main>
  );
}
