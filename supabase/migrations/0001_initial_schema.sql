-- ============================================================================
-- D2OS Care Tracker — initial schema
--
-- Data access model: the Next.js app talks to Postgres exclusively through
-- the Supabase SERVICE ROLE key from server-side code. Row Level Security is
-- enabled on every table with NO policies, which means the anon/authenticated
-- Postgrest roles can read/write nothing. Application-level authorization
-- (owner-or-admin edit rules, admin-only settings) is enforced in the app's
-- server layer, keyed off the Okta SSO identity.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Team members (mapped to Okta identities by email)
-- ----------------------------------------------------------------------------
create table public.team_members (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  name        text not null,
  title       text,
  role        text not null default 'csm' check (role in ('admin', 'csm')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Configurable care tiers. Seeded with the 3-Tier Care Model; extensible
-- without a schema change (add rows, not columns).
-- ----------------------------------------------------------------------------
create table public.escalation_tiers (
  key         text primary key,
  label       text not null,
  description text,
  urgency     text,
  color       text not null default '#64748b',
  sort_order  integer not null default 0,
  active      boolean not null default true
);

-- ----------------------------------------------------------------------------
-- Configurable escalation types (Risk Warning / Operational Problem /
-- Executive Visibility). Whether the type dimension is used at all is a
-- runtime setting (app_settings.types_enabled) — the open design question
-- with Elena can be settled without a schema rebuild.
-- ----------------------------------------------------------------------------
create table public.escalation_types (
  key         text primary key,
  label       text not null,
  description text,
  sort_order  integer not null default 0,
  active      boolean not null default true
);

-- ----------------------------------------------------------------------------
-- Customer accounts. Manual entry today; the `source` and `gainsight_id`
-- columns are the seam where the live Gainsight connector plugs in later.
-- ----------------------------------------------------------------------------
create table public.accounts (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  gainsight_id text,
  industry     text,
  notes        text,
  source       text not null default 'manual' check (source in ('manual', 'gainsight')),
  created_by   uuid references public.team_members (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Escalations — the core record
-- ----------------------------------------------------------------------------
create table public.escalations (
  id                     uuid primary key default gen_random_uuid(),
  account_id             uuid references public.accounts (id),
  account_name           text not null,
  title                  text not null,
  description            text not null,
  tier_key               text not null references public.escalation_tiers (key),
  type_key               text references public.escalation_types (key),
  status                 text not null default 'open'
                         check (status in ('open', 'in_progress', 'resolved', 'archived')),
  owner_id               uuid not null references public.team_members (id),
  created_by             uuid references public.team_members (id),
  opened_at              date not null default current_date,
  target_resolution_date date,
  resolved_at            timestamptz,
  archived_at            timestamptz,
  -- Care 3: flagged for the executive reporting pipeline
  executive_reporting    boolean not null default false,
  -- Care 3: explicit, manual elevation to leadership (never automatic)
  elevated_at            timestamptz,
  elevated_by            uuid references public.team_members (id),
  -- Care 2: recurring cadence
  cadence_days           integer,
  next_cadence_date      date,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index escalations_status_idx  on public.escalations (status);
create index escalations_owner_idx   on public.escalations (owner_id);
create index escalations_tier_idx    on public.escalations (tier_key);
create index escalations_opened_idx  on public.escalations (opened_at);
create index escalations_account_idx on public.escalations (account_id);

-- ----------------------------------------------------------------------------
-- Notes / comments at each workflow stage
-- ----------------------------------------------------------------------------
create table public.escalation_comments (
  id             uuid primary key default gen_random_uuid(),
  escalation_id  uuid not null references public.escalations (id) on delete cascade,
  author_id      uuid not null references public.team_members (id),
  body           text not null,
  -- status of the escalation at the time the note was written
  status_context text,
  created_at     timestamptz not null default now()
);

create index escalation_comments_escalation_idx
  on public.escalation_comments (escalation_id, created_at);

-- ----------------------------------------------------------------------------
-- Care 2 cadence touchpoints
-- ----------------------------------------------------------------------------
create table public.cadence_touchpoints (
  id                uuid primary key default gen_random_uuid(),
  escalation_id     uuid not null references public.escalations (id) on delete cascade,
  touchpoint_date   date not null default current_date,
  notes             text not null,
  action_items      text,
  next_cadence_date date,
  created_by        uuid not null references public.team_members (id),
  created_at        timestamptz not null default now()
);

create index cadence_touchpoints_escalation_idx
  on public.cadence_touchpoints (escalation_id, touchpoint_date desc);

-- ----------------------------------------------------------------------------
-- In-app notifications
-- ----------------------------------------------------------------------------
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references public.team_members (id),
  escalation_id uuid references public.escalations (id) on delete cascade,
  kind          text not null,   -- cadence_due | elevation | assignment | status_change | system
  title         text not null,
  body          text,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index notifications_recipient_idx
  on public.notifications (recipient_id, read_at, created_at desc);

-- ----------------------------------------------------------------------------
-- App settings (key/value, admin-editable at runtime)
-- ----------------------------------------------------------------------------
create table public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.team_members (id)
);

-- ----------------------------------------------------------------------------
-- Audit trail
-- ----------------------------------------------------------------------------
create table public.audit_log (
  id            bigint generated always as identity primary key,
  actor_id      uuid references public.team_members (id),
  action        text not null,
  escalation_id uuid,
  details       jsonb,
  created_at    timestamptz not null default now()
);

create index audit_log_escalation_idx on public.audit_log (escalation_id, created_at desc);

-- ----------------------------------------------------------------------------
-- Stored AI outputs (summaries, classifications, executive summaries)
-- ----------------------------------------------------------------------------
create table public.ai_outputs (
  id            uuid primary key default gen_random_uuid(),
  escalation_id uuid references public.escalations (id) on delete cascade,
  kind          text not null check (kind in ('spina_summary', 'classification', 'exec_summary')),
  content       text not null,
  model         text not null,
  created_by    uuid references public.team_members (id),
  created_at    timestamptz not null default now()
);

create index ai_outputs_escalation_idx on public.ai_outputs (escalation_id, kind, created_at desc);

-- ----------------------------------------------------------------------------
-- updated_at maintenance
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger escalations_set_updated_at
  before update on public.escalations
  for each row execute function public.set_updated_at();

create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security: enabled everywhere, no policies. Only the service role
-- (used by the app server) can touch data. Client-side/anon access: none.
-- ----------------------------------------------------------------------------
alter table public.team_members        enable row level security;
alter table public.escalation_tiers    enable row level security;
alter table public.escalation_types    enable row level security;
alter table public.accounts            enable row level security;
alter table public.escalations         enable row level security;
alter table public.escalation_comments enable row level security;
alter table public.cadence_touchpoints enable row level security;
alter table public.notifications       enable row level security;
alter table public.app_settings        enable row level security;
alter table public.audit_log           enable row level security;
alter table public.ai_outputs          enable row level security;

-- ============================================================================
-- Seed data
-- ============================================================================

-- Tier colors are CVD-validated as a categorical chart palette
-- (deutan/protan/tritan ΔE all pass) — keep that property if you change them.
insert into public.escalation_tiers (key, label, description, urgency, color, sort_order) values
  ('care_1', 'Care 1',
   'Informational / email-level escalation. Low urgency, async communication.',
   'Low', '#0284c7', 1),
  ('care_2', 'Care 2',
   'Daily cadence escalation requiring recurring touchpoints and working sessions. Moderate urgency.',
   'Moderate', '#d97706', 2),
  ('care_3', 'Care 3',
   'Executive-level escalation requiring full leadership visibility. Highest urgency, formal reporting pipeline.',
   'Highest', '#9f1239', 3);

insert into public.escalation_types (key, label, description, sort_order) values
  ('risk_warning',         'Risk Warning',
   'Early signal of customer risk that has not yet materialized into an operational failure.', 1),
  ('operational_problem',  'Operational Problem',
   'Active operational issue impacting delivery or customer outcomes.', 2),
  ('executive_visibility', 'Executive Visibility',
   'Escalation driven by, or requiring, executive attention.', 3);

-- Team roster. IMPORTANT: emails must match the email claim returned by Okta.
-- Adjust in the Admin page (or here) if any address differs.
insert into public.team_members (email, name, title, role) values
  ('elena.vitkin@wwt.com',  'Elena Vitkin',  'Sr. Manager, Day-2 Operations', 'admin'),
  ('will.feil@wwt.com',     'Will Feil',     'Customer Success Manager',      'csm'),
  ('jamell.mixon@wwt.com',  'Jamell Mixon',  'Customer Success Manager',      'csm'),
  ('scott.moyer@wwt.com',   'Scott Moyer',   'Customer Success Manager',      'csm'),
  ('chris.nickl@wwt.com',   'Chris Nickl',   'Director, Engineering Services','csm'),
  ('tara.maher@wwt.com',    'Tara Maher',    'Customer Success Manager',      'csm'),
  -- System administrator (app maintainer)
  ('elliot.becker@wwt.com', 'Elliot Becker', 'Intern, Day-2 Operations',      'admin');

insert into public.app_settings (key, value) values
  -- Open design question with Elena: tiers-only vs tiers + types.
  -- Flip to true to surface the type field everywhere — no schema change.
  ('types_enabled', 'false'::jsonb),

  -- Resolved escalations are auto-archived after this many days.
  ('auto_archive_days', '14'::jsonb),

  -- Default cadence interval (days) applied to new Care 2 escalations.
  ('care2_default_cadence_days', '1'::jsonb),

  -- Care 3 escalation-visibility chain. Elevation always notifies D2OS
  -- admins (Elena). When enabled=true, the recipients below are added to the
  -- formal notification record, in order, up Elena''s management chain.
  -- Configurable — intentionally NOT hardcoded into application logic.
  ('care3_visibility_chain', '{
     "enabled": false,
     "recipients": [
       {"name": "Chris Nickl",   "title": "Director, Engineering Services",     "email": "chris.nickl@wwt.com"},
       {"name": "Rich Dobry Jr.","title": "Sr. Director, Engineering Services", "email": "rich.dobry@wwt.com"},
       {"name": "Jeff Wynne",    "title": "VP, Advanced Technical Solutions",   "email": "jeff.wynne@wwt.com"}
     ]
   }'::jsonb);
