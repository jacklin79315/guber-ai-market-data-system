-- P4 research checkpoint storage. Migration only; no destructive changes.
-- Backend service-role access only. Never expose the service key in frontend code.
create table if not exists public.p4_research_checkpoints (
 job_id text primary key check (job_id ~ '^[A-Za-z0-9_-]{1,100}$'),
 checkpoint jsonb not null,
 updated_at timestamptz not null default now(),
 constraint p4_checkpoint_object check (jsonb_typeof(checkpoint) = 'object')
);
alter table public.p4_research_checkpoints enable row level security;
revoke all on public.p4_research_checkpoints from anon, authenticated;
comment on table public.p4_research_checkpoints is 'P4 backend-only research progress; checkpoint does not authorize Champion promotion or live orders';
