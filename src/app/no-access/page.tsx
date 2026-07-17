import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Access pending" };

export default async function NoAccessPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.memberId) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-10 text-center shadow-2xl">
        <h1 className="text-xl font-semibold text-slate-900">
          Access not provisioned
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          You signed in as{" "}
          <span className="font-medium text-slate-700">
            {session.user.email}
          </span>
          , but this account is not on the D2OS Care Tracker roster. Ask Elena
          Vitkin (or an app administrator) to add you on the Admin page.
        </p>
        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
