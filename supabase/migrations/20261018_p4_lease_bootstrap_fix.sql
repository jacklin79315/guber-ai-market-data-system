-- New jobs must acquire a lease before their first checkpoint exists.
-- The old FK made this impossible; lease ownership is independent of checkpoint creation.
alter table public.p4_research_leases
 drop constraint if exists p4_research_leases_job_id_fkey;
