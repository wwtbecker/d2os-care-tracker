# D2OS Care Tracker

Customer escalation tracking for the WWT **Day 2 Operations (D2OS)** CSM team,
built around the **3-Tier Care Model**. Replaces the shared HTML file with a
centralized, Okta-authenticated, team-deployable system.

| | |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript, Tailwind 4) |
| Auth | NextAuth v5 + **Okta OIDC** (`https://sso.wwt.com/oauth2/default`) |
| Database | **Supabase** (Postgres, service-role access only, RLS locked down) |
| AI | Anthropic Claude (`claude-opus-4-8`) — SPINA summaries, tier suggestions, weekly executive summaries |
| Exports | CSV + PowerPoint (pptxgenjs) for leadership syncs |

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
  (auto-populated from the Okta session), tier (+ optional type), description,
  status, date opened, target resolution date.
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

## Setup

### 1. Supabase

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
3. **Verify roster emails match Okta.** Seeded addresses follow the
   `first.last@wwt.com` pattern — if anyone's Okta email differs, fix it on
   the Admin page (or in the seed) or they'll land on “access not
   provisioned”.

### 2. Okta

Create an **OIDC Web Application** in the WWT Okta org (issuer
`https://sso.wwt.com/oauth2/default`):

- Sign-in redirect URI: `https://<your-domain>/api/auth/callback/okta`
  (plus `http://localhost:3000/api/auth/callback/okta` for local dev)
- Sign-out redirect URI: `https://<your-domain>/login`
- Assignment: the D2OS CSM team (app access is additionally gated by the
  roster table, so broad Okta assignment is safe).

### 3. Environment

Copy `.env.example` → `.env.local` and fill in Okta client credentials,
`AUTH_SECRET` (`openssl rand -base64 32`), Supabase URL + **service role
key**, and `ANTHROPIC_API_KEY`. `CRON_SECRET` is optional but recommended in
production.

### 4. Run

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build (CI gate)
```

### 4b. Synthetic test data (local/dev only)

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
production project once real escalation data exists** — it's for local/dev
environments.

### 5. Deploy

Any Node host works. On Vercel, `vercel.json` already schedules the daily
maintenance cron (`/api/cron/maintenance` — auto-archive + cadence
reminders); set `CRON_SECRET` so only the scheduler can call it. On other
hosts, hit that endpoint daily with
`Authorization: Bearer $CRON_SECRET` — or rely on the built-in fallback:
the same maintenance runs opportunistically whenever the dashboard loads.

## Data sensitivity

This system holds **live client escalation data** (Pfizer, SSM Health,
PANYNJ, Santen, …):

- No browser-local storage of escalation data — everything lives in Postgres
  and renders server-side.
- RLS is enabled on every table with no policies: the anon key is useless
  even if leaked; only the server's service-role key can read data, and it
  never leaves the server.
- Every mutation is authorized against the Okta-derived roster identity and
  captured in `audit_log`.
- AI calls send escalation content to the Anthropic API — use a
  WWT-sanctioned Anthropic account and confirm data-handling terms before
  launch.

## Architecture notes

```
src/
  auth.ts                    NextAuth v5 + Okta; roster binding in JWT callbacks
  lib/
    supabase.ts              service-role client (server-only)
    data.ts                  all queries + maintenance job
    permissions.ts           owner-or-admin rules (single source of truth)
    reporting.ts             snapshot/trend/time-to-resolution aggregation
    anthropic.ts             Claude client (claude-opus-4-8)
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

1. *All 6 CSMs logging within 2 weeks* — roster pre-seeded; sign-in is
   two clicks via existing WWT SSO; logging form is one page with AI tier
   assist.
2. *Performance / no data loss / uptime* — server-rendered pages over
   indexed Postgres queries; nothing is ever deleted (archive, not delete);
   audit log on every mutation.
3. *Framework confirmation with Elena* — the one open item is a runtime
   toggle (Admin → escalation types), so the schema is already final.
4. *Weekly summaries in <5 min* — `/reports` renders the snapshot live;
   CSV/PPTX are one click; the AI executive summary generates in under a
   minute.
