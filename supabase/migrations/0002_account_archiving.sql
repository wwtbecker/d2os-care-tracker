-- ============================================================================
-- Admin-initiated account archiving.
--
-- Accounts get the same soft-archive treatment escalations already have:
-- archived records disappear from active pickers/lists but stay viewable and
-- restorable — nothing is ever deleted. Used to clean up test/junk accounts
-- created during POC testing.
-- ============================================================================

alter table public.accounts
  add column archived_at timestamptz,
  add column archived_by uuid references public.team_members (id);
