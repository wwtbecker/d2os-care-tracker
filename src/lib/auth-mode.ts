/**
 * Identity-source switch for the app.
 *
 * The app is currently in its PROOF OF CONCEPT phase (per Elena: the team
 * tests the workflow first, real login security comes after sign-off), so
 * the default mode is "poc":
 *
 *  - "poc"  (default) — no external identity provider. The login page shows
 *    a picker of the active team roster; choosing a name creates a session
 *    as that member. There is NO password and NO security — anyone who can
 *    reach the app can act as anyone on the roster. Synthetic data only.
 *
 *  - "okta" — the original WWT SSO flow (NextAuth + Okta OIDC), plus the
 *    old DEV_BYPASS_AUTH stopgap. Set AUTH_MODE=okta (with the Okta env
 *    vars from .env.example) to leave POC mode; no code changes needed.
 *
 * Either way, AUTHORIZATION is identical: the session is bound to an active
 * `team_members` row, and every permission rule (owner/admin editing,
 * Care 3 elevation, admin pages) runs against that roster identity. Only
 * the way a user proves who they are differs between modes.
 */

export type AuthMode = "poc" | "okta";

export function authMode(): AuthMode {
  return process.env.AUTH_MODE === "okta" ? "okta" : "poc";
}

export function pocMode(): boolean {
  return authMode() === "poc";
}
