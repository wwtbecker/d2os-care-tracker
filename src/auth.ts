import NextAuth, { type NextAuthConfig } from "next-auth";
import Okta from "next-auth/providers/okta";
import Credentials from "next-auth/providers/credentials";
import { getTeamMemberByEmail, getTeamMemberById } from "@/lib/data";
import { authMode, pocMode } from "@/lib/auth-mode";
import {
  assertDevBypassSafe,
  devBypassEmail,
  devBypassEnabled,
} from "@/lib/dev-bypass";

// Hard kill-switch: crashes the app at load time (including `next build` and
// `next start`, which run with NODE_ENV=production) if the dev bypass flag
// is ever set in a production environment.
assertDevBypassSafe();

const providers: NextAuthConfig["providers"] = [];

if (pocMode()) {
  // PROOF-OF-CONCEPT identity source (see src/lib/auth-mode.ts): the login
  // page lists the active roster; picking a name signs you in as that
  // member. No password, no external provider — the identity is minted from
  // the roster row itself, then flows through the exact same jwt/session
  // roster binding as an Okta sign-in would, so every permission rule
  // downstream behaves identically to production.
  providers.push(
    Credentials({
      id: "roster",
      name: "Team roster (proof of concept)",
      credentials: { memberId: {} },
      authorize: async (credentials) => {
        const memberId =
          typeof credentials?.memberId === "string" ? credentials.memberId : "";
        if (!memberId) return null;
        const member = await getTeamMemberById(memberId);
        if (!member || !member.active) return null;
        return { id: member.id, email: member.email, name: member.name };
      },
    })
  );
} else {
  // Real WWT SSO — inactive during the POC phase; restored with
  // AUTH_MODE=okta once Elena signs off on adding login security.
  providers.push(
    Okta({
      clientId: process.env.OKTA_CLIENT_ID,
      clientSecret: process.env.OKTA_CLIENT_SECRET,
      issuer: process.env.OKTA_ISSUER,
    })
  );

  // TEMPORARY dev-only bypass (see src/lib/dev-bypass.ts). Okta mode only.
  // The provider is not even registered unless DEV_BYPASS_AUTH=true outside
  // production, and the identity it mints still has to pass the roster check
  // below like any other.
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
}

/**
 * NextAuth v5. The identity source depends on AUTH_MODE (roster picker for
 * the POC, Okta OIDC for production — see src/lib/auth-mode.ts), but
 * authorization is always the same: the identity is resolved against the
 * team_members table (matched on email). Users who authenticate but are not
 * on the roster get a session with role=null and are routed to /no-access —
 * nothing in the app is readable without an active roster entry.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  // POC mode must run with zero configuration (npm install && npm run dev),
  // so it falls back to a fixed secret when AUTH_SECRET is unset. That makes
  // session cookies forgeable — acceptable only because POC mode is already,
  // by design, an unauthenticated pick-your-name flow over synthetic data.
  // Okta mode has no fallback: AUTH_SECRET is required there.
  secret:
    process.env.AUTH_SECRET ??
    (pocMode() ? `d2os-poc-no-security-${authMode()}` : undefined),
  callbacks: {
    async jwt({ token, user }) {
      // On sign-in (or if the token predates roster binding), resolve the
      // authenticated identity to a roster entry.
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
