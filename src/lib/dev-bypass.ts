/**
 * TEMPORARY dev-only auth bypass (for local UI/workflow testing while Okta
 * credentials are pending from IT). Remove once Okta is provisioned.
 *
 * Safety model:
 *  - Only activates when DEV_BYPASS_AUTH=true (set it in .env.local only).
 *  - assertDevBypassSafe() hard-fails the entire app if the flag is set
 *    while NODE_ENV is production — `next build` and `next start` both run
 *    with NODE_ENV=production, so a production build/boot with the flag set
 *    crashes immediately rather than shipping an open door.
 *  - The signed-in identity must still exist (active) in team_members —
 *    the bypass skips Okta, never the roster authorization.
 */

export function devBypassEnabled(): boolean {
  return (
    process.env.DEV_BYPASS_AUTH === "true" &&
    process.env.NODE_ENV !== "production"
  );
}

export function devBypassEmail(): string {
  return process.env.DEV_BYPASS_EMAIL ?? "elliot.becker@wwt.com";
}

export function assertDevBypassSafe(): void {
  if (
    process.env.DEV_BYPASS_AUTH === "true" &&
    process.env.NODE_ENV === "production"
  ) {
    throw new Error(
      "FATAL: DEV_BYPASS_AUTH=true with NODE_ENV=production. " +
        "The dev auth bypass must never be enabled in production — remove " +
        "DEV_BYPASS_AUTH from the environment."
    );
  }
}
