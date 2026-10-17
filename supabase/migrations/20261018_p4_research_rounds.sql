-- Append-only committed P4 research rounds. Backend service-role only.
create table if not exists public.p4_research_rounds (
 job_id text not null references public.p4_research_checkpoints(job_id) on delete restrict,
 iteration integer not null check (iteration between 1 and 100),
 spec_fingerprint text not null check (spec_fingerprint ~ '^[a-f0-9]{64}$'),
 round_result jsonb not null check (jsonb_typeof(round_result) = 'object'),
 committed_at timestamptz not null default now(),
 primary key(job_id,iteration)
);
alter table public.p4_research_rounds enable row level security;
revoke all on public.p4_research_rounds from anon,authenticated;
comment on table public.p4_research_rounds is 'Immutable P4 research round records. No automatic Champion promotion.';
