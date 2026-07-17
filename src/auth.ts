import NextAuth, { type NextAuthConfig } from "next-auth";
import Okta from "next-auth/providers/okta";
import Credentials from "next-auth/providers/credentials";
import { getTeamMemberByEmail } from "@/lib/data";
import {
  assertDevBypassSafe,
  devBypassEmail,
  devBypassEnabled,
} from "@/lib/dev-bypass";

// Hard kill-switch: crashes the app at load time (including `next build` and
// `next start`, which run with NODE_ENV=production) if the dev bypass flag
// is ever set in a production environment.
assertDevBypassSafe();

const providers: NextAuthConfig["providers"] = [
  Okta({
    clientId: process.env.OKTA_CLIENT_ID,
    clientSecret: process.env.OKTA_CLIENT_SECRET,
    issuer: process.env.OKTA_ISSUER,
  }),
];

// TEMPORARY dev-only bypass (see src/lib/dev-bypass.ts). The provider is not
// even registered unless DEV_BYPASS_AUTH=true outside production, and the
// identity it mints still has to pass the roster check below like any other.
if (devBypassEnabled()) {
  providers.push(
    Credentials({
      id: "dev-bypass",
      name: "Dev bypass (local only)",
      credentials: {},
      authorize: async () => {
        if (!devBypassEnabled()) return null; // defense in depth
        const email = devBypassEmail();
        return { id: `dev-bypass:${email}`, email, name: email };
      },
    })
  );
}

/**
 * Okta OIDC via NextAuth v5. Identity is Okta's; authorization comes from the
 * team_members table (matched on email). Users who authenticate with Okta but
 * are not on the roster get a session with role=null and are routed to
 * /no-access — nothing in the app is readable without an active roster entry.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  callbacks: {
    async jwt({ token, user }) {
      // On sign-in (or if the token predates roster binding), resolve the
      // Okta identity to a roster entry.
      if (user?.email || token.memberId === undefined) {
        const email = (user?.email ?? token.email) as string | undefined;
        if (email) {
          try {
            const member = await getTeamMemberByEmail(email);
            token.memberId = member && member.active ? member.id : null;
            token.role = member && member.active ? member.role : null;
            token.memberName = member?.name ?? user?.name ?? token.name ?? null;
          } catch {
            // Database unreachable during sign-in — leave unauthorized rather
            // than failing the whole auth flow.
            token.memberId = null;
            token.role = null;
          }
        } else {
          token.memberId = null;
          token.role = null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.memberId = (token.memberId as string | null) ?? null;
      session.user.role = (token.role as "admin" | "csm" | null) ?? null;
      if (token.memberName) session.user.name = token.memberName as string;
      return session;
    },
  },
});
