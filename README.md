# D2OS Care Tracker

Customer escalation tracking for the WWT **Day 2 Operations (D2OS)** CSM team,
built around the **3-Tier Care Model**. Replaces the shared HTML file with a
centralized, team-deployable system.

> ## ⚠️ Current phase: PROOF OF CONCEPT — no login security
>
> Per Elena's direction, the team tests the working app **before** any
> security is added. In this build:
>
> - **There is no real login.** The sign-in page is a "pick your name"
>   dropdown of the team roster (Elena, Will, Jamell, Scott, Chris, Tara,
>   Elliot). No passwords, no Okta. Anyone who can reach the app can act as
>   anyone on the roster.
> - **Synthetic data only.** All seeded accounts and escalations are
>   fictional. **Never enter real client data into this build** — a banner on
>   every page says exactly that.
> - All role/permission rules (owner-or-admin editing, Care 3 elevation,
>   roster-gated access) are the real production rules — only the way you
>   *identify* yourself is simplified.
> - Real Okta SSO is built and stays in the codebase, switched off behind
>   `AUTH_MODE` (see [Re-enabling Okta](#re-enabling-okta-post-poc-phase)).

| | |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript, Tailwind 4) |
| Auth | **POC: roster name-picker (no security)** · post-POC: NextAuth v5 + Okta OIDC (`https://sso.wwt.com/oauth2/default`) |
| Database | **Supabase** (Postgres, service-role access only, RLS locked down) |
| AI | Anthropic Claude (`claude-opus-4-8`) — SPINA summaries, tier suggestions, weekly executive summaries. **Optional:** degrades to a clear "unavailable" note when `ANTHROPIC_API_KEY` is unset |
| Exports | CSV + PowerPoint (pptxgenjs) for leadership syncs |

## Quick start (POC)

```bash
npm install
cp .env.example .env.local   # fill in SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
npm run seed:dev             # one command: loads the synthetic test data
npm run dev                  # http://localhost:3000
```

Open the app, pick a name from the dropdown, and click through. To try a
different role, hit **Switch user** at the bottom of the sidebar.

- Only the two Supabase values are required. No Okta config, no
  `AUTH_SECRET`, no Anthropic key needed to run the POC.
- The database schema + roster must exist once per Supabase project: run
  `supabase/migrations/0001_initial_schema.sql` in the SQL editor (already
  done for the shared POC project).
- `npm run seed:dev` is safe to re-run any time — it clears the previous
  synthetic data and reseeds fresh, with dates relative to today so
  dashboards always look live. `npm run seed:dev -- --clear` removes the
  synthetic data without reseeding.

### Who's who in the POC roster

| Name | Role | Can |
|---|---|---|
| Elena Vitkin | Admin | Everything: edit/close anyone's escalations, Admin page, archive |
| Will, Jamell, Scott, Chris, Tara | CSM | View everything; edit/close/log touchpoints **only on their own** escalations; elevate their own Care 3s |
| Elliot Becker | Admin | Same as Elena (system admin) |

### Suggested 5-minute test script

1. Pick **Will** → dashboard → *Log escalation* → create a Care 2 for a
   fictional account → log a touchpoint on it.
2. Open one of **Tara's** escalations → confirm you can comment but **not**
   edit/close it (no edit controls; the rule is also enforced server-side).
3. *Switch user* → **Elena** → open the same escalation → you *can* edit it
   (admin override). Try **Reports** → CSV export and the PowerPoint deck.
4. Still as Elena, open the not-yet-elevated Care 3 for **Helix
   BioSciences** → *Elevate to leadership* → switch to **Elliot** (the other
   admin) to see the elevation notification.
5. Note the AI panels: without `ANTHROPIC_API_KEY` they show *“AI features
   unavailable — API key not configured”* instead of failing.

## The 3-Tier Care Model

| Tier | Meaning | System behavior |
|---|---|---|
| **Care 1** | Informational / email-level. Low urgency, async. | Standard tracking + workflow |
| **Care 2** | Daily-cadence escalation with recurring touchpoints. | Cadence interval + next-touchpoint date, touchpoint log (date / notes / action items / next cadence), automatic **“touchpoint due”** notifications |
| **Care 3** | Executive-level, full leadership visibility. | Flagged for executive reporting, **explicit manual “Elevate to leadership”** action (never silent auto-alerts), bulk CSV/PPTX export, weekly AI executive summary |

**Tiers vs. tiers + types is still open with Elena** — so it's a runtime
setting, not a schema decision. Tiers and types are configurable enums
(`escalation_tiers` / `escalation_types` tables, editable on the Admin page).
Flip **Admin → “Enable escalation types”** to switch the whole app to the
tiers + types model (Risk Warning / Operational Problem / Executive
Visibility) with zero schema changes or downtime.

## Feature map

- **Entry & logging** — create/update escalations with account, CSM owner
  (auto-populated from the signed-in identity), tier (+ optional type),
  description, status, date opened, target resolution date.
- **Gainsight (stubbed)** — accounts are manual records with an optional
  `gainsight_id` and a `source` column (`manual` / `gainsight`). When the live
  connector ships, it upserts into the same `accounts` table and existing
  escalations reconcile in place. Swap point: `src/lib/data.ts`
  (`getAccounts` / `searchAccounts`) + `src/app/actions.ts`
  (`findOrCreateAccount`).
- **Permissions** — every active roster member sees every escalation; only
  the **assigned owner or an admin (Elena)** can edit/close/log touchpoints.
  Admins have full override. Enforced server-side in every action
  (`src/lib/permissions.ts`), not just hidden in the UI.
- **Workflow** — Open → In Progress → Resolved, with notes at each stage
  transition; full team-visible notes timeline; complete audit log per record.
- **Auto-archival** — resolved escalations archive automatically after a
  configurable number of days (default 14); the archive stays fully
  searchable (`/archive`). Runs via daily cron *and* opportunistically on
  dashboard loads, so it works without any scheduler.
- **Notifications (in-app)** — Care 2 cadence reminders (built-in default),
  assignment/reassignment notices, Care 3 elevation notices.
- **Care 3 visibility chain** — off by default. Elevation always notifies
  D2OS admins; when Elena enables the chain on the Admin page, the ordered
  Nickl → Dobry → Wynne chain (fully editable, not hardcoded) is added to the
  formal elevation record and notified in-app where accounts exist.
- **Reporting & insights** (`/reports`) — weekly snapshot (open by tier / CSM
  / account), 12-week volume trend stacked by tier, average
  time-to-resolution by tier, CSV export (active / full history), PowerPoint
  leadership deck (snapshot + one slide per Care 3 escalation, using the
  latest AI summary when available).
- **AI** — per-escalation **SPINA** (Situation-Problem-Impact-Need-Action)
  summaries from the record + notes + touchpoints; tier/type suggestion from
  the description at logging time; auto-generated weekly Care 3 executive
  summary. All outputs are persisted (`ai_outputs`) with model attribution.
  **If `ANTHROPIC_API_KEY` is not set** (it's still pending from IT), every
  AI surface shows *“AI features unavailable — API key not configured”* and
  the rest of the app is unaffected.

## How POC auth works (and why it's safe to re-enable Okta later)

`AUTH_MODE` (default `poc`) selects the **identity source** only:

- **`poc`** — the login page lists active `team_members`; picking a name
  calls a NextAuth Credentials provider (`roster`) that mints the identity
  from that roster row. No password, no external calls.
- **`okta`** — the original Okta OIDC provider (plus the old
  `DEV_BYPASS_AUTH` stopgap) registers instead. This code path is untouched,
  just inactive.

Both paths converge in the same NextAuth `jwt` callback, which binds the
session to an **active roster entry by email** — so `requireMember` /
`requireAdmin`, the owner-or-admin edit rules, Care 3 elevation gating, and
the audit trail behave identically in both modes. Swapping back to Okta
changes only who can *become* a given roster member, not what that member
can do. See `src/lib/auth-mode.ts` and `src/auth.ts`.

## Setup from scratch (new Supabase project)

1. Create a Supabase project (WWT-approved org).
2. Run `supabase/migrations/0001_initial_schema.sql` in the SQL editor (or
   `supabase db push`). This creates all tables, enables RLS with **no
   policies** (service-role-only access — nothing is readable by anon or
   browser clients), and seeds:
   - the 3 care tiers + 3 escalation types,
   - the team roster (Elena as admin; Will, Jamell, Scott, Chris, Tara as
     CSMs; Elliot as system admin),
   - default settings (types off, 14-day auto-archive, 1-day Care 2 cadence,
     visibility chain **disabled** with Nickl → Dobry → Wynne pre-staged).
3. Copy `.env.example` → `.env.local`, fill in `SUPABASE_URL` +
   `SUPABASE_SERVICE_ROLE_KEY`, then `npm run seed:dev` and `npm run dev`.

## Re-enabling Okta (post-POC phase)

Once Elena approves moving past the POC:

1. Create an **OIDC Web Application** in the WWT Okta org (issuer
   `https://sso.wwt.com/oauth2/default`):
   - Sign-in redirect URI: `https://<your-domain>/api/auth/callback/okta`
     (plus `http://localhost:3000/api/auth/callback/okta` for local dev)
   - Sign-out redirect URI: `https://<your-domain>/login`
   - Assignment: the D2OS CSM team (app access is additionally gated by the
     roster table, so broad Okta assignment is safe).
2. Set in the environment: `AUTH_MODE=okta`, `OKTA_CLIENT_ID`,
   `OKTA_CLIENT_SECRET`, and `AUTH_SECRET` (`openssl rand -base64 32`).
3. **Verify roster emails match Okta.** Seeded addresses follow the
   `first.last@wwt.com` pattern — if anyone's Okta email differs, fix it on
   the Admin page (or in the seed) or they'll land on “access not
   provisioned”.
4. Clear the synthetic data before real use: `npm run seed:dev -- --clear`.

The POC name picker, the banner, and the `AUTH_SECRET` fallback all
deactivate automatically in `okta` mode.

## Synthetic test data

```bash
npm run seed:dev            # clears previous seed data, then reseeds
npm run seed:dev -- --clear # removes seed data only
```

Seeds 7 **fictional** accounts (no real WWT clients) and 18 escalations with
realistic variation: overdue Care 2 cadences, an elevated Care 3 case with a
full note history, resolved + archived records, and deliberately messy
description text so the AI summarization/tier-suggestion features have real
material. All seeded accounts carry a `SEED-` Gainsight ID, so clearing is
exact and re-running is safe. Dates are relative to the run date, so a
reseed always produces live-looking dashboards. **Don't run this against the
production project once real escalation data exists** — it's for the POC and
local/dev environments.

## Build & deploy

```bash
npm run build   # production build (CI gate)
```

Any Node host works. On Vercel, `vercel.json` already schedules the daily
maintenance cron (`/api/cron/maintenance` — auto-archive + cadence
reminders); set `CRON_SECRET` so only the scheduler can call it. On other
hosts, hit that endpoint daily with
`Authorization: Bearer $CRON_SECRET` — or rely on the built-in fallback:
the same maintenance runs opportunistically whenever the dashboard loads.

**POC deployments must stay inside WWT** (shared machine, screen-share, or
an internal host): there is no login security until `AUTH_MODE=okta`.

## Data sensitivity

**POC phase: synthetic data only.** The banner on every page is the
contract — no real client names, no real escalation details, until Okta is
re-enabled.

The production posture (unchanged, and why the POC is safe to promote later):

- No browser-local storage of escalation data — everything lives in Postgres
  and renders server-side.
- RLS is enabled on every table with no policies: the anon key is useless
  even if leaked; only the server's service-role key can read data, and it
  never leaves the server.
- Every mutation is authorized against the roster identity bound to the
  session and captured in `audit_log`.
- AI calls send escalation content to the Anthropic API — use a
  WWT-sanctioned Anthropic account and confirm data-handling terms before
  launch.

## Architecture notes

```
src/
  auth.ts                    NextAuth v5; identity source per AUTH_MODE
                             (POC roster picker / Okta); roster binding in
                             JWT callbacks either way
  lib/
    auth-mode.ts             AUTH_MODE switch (poc | okta)
    supabase.ts              service-role client (server-only)
    data.ts                  all queries + maintenance job
    permissions.ts           owner-or-admin rules (single source of truth)
    reporting.ts             snapshot/trend/time-to-resolution aggregation
    anthropic.ts             Claude client (claude-opus-4-8) + aiEnabled() gate
  components/
    poc-banner.tsx           the every-page "proof of concept" notice
  app/
    actions.ts               every mutation (server actions, permission-checked)
    (app)/                   authenticated shell: dashboard, escalations,
                             accounts, reports, archive, notifications, admin
    api/ai/*                 classify, summarize (SPINA), executive-summary
    api/export/*             csv, pptx
    api/cron/maintenance     auto-archive + cadence reminders
supabase/migrations/         schema + seeds (single migration to date)
```

**Extensibility seams built in from day one:**

- Tier/type sets are DB rows, not code — extend on the Admin page.
- The Care 3 visibility chain is a JSON setting with an ordered recipient
  list — swap in email/Teams delivery later by extending
  `elevateEscalation` in `src/app/actions.ts` (the notification fan-out is
  already centralized there).
- Gainsight connector: implement against the `accounts` table
  (`source='gainsight'`, match on `gainsight_id`).

## Success criteria mapping

1. *All 6 CSMs logging within 2 weeks* — roster pre-seeded; POC sign-in is
   two clicks; logging form is one page with AI tier assist.
2. *Performance / no data loss / uptime* — server-rendered pages over
   indexed Postgres queries; nothing is ever deleted (archive, not delete);
   audit log on every mutation.
3. *Framework confirmation with Elena* — the one open item is a runtime
   toggle (Admin → escalation types), so the schema is already final.
4. *Weekly summaries in <5 min* — `/reports` renders the snapshot live;
   CSV/PPTX are one click; the AI executive summary generates in under a
   minute.
