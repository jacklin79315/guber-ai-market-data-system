-- P4 backend-only lease table. A lease is required before launching a durable job.
-- No anonymous/authenticated access; stale lease recovery requires an explicit owner change.
create table if not exists public.p4_research_leases (
 job_id text primary key references public.p4_research_checkpoints(job_id) on delete restrict,
 owner_token text not null check (length(owner_token) between 16 and 128),
 acquired_at timestamptz not null default now(),
 expires_at timestamptz not null,
 check (expires_at > acquired_at)
);
alter table public.p4_research_leases enable row level security;
revoke all on public.p4_research_leases from anon, authenticated;
-- Atomic lease acquisition: only an expired lease can be taken over.
create or replace function public.p4_claim_research_lease(p_job_id text,p_owner_token text,p_seconds integer default 900)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare v_rows integer;
begin
 if length(p_owner_token) < 16 or length(p_owner_token)>128 or p_seconds<30 or p_seconds>3600 then
  raise exception 'invalid P4 lease request';
 end if;
 insert into public.p4_research_leases(job_id,owner_token,expires_at)
 values(p_job_id,p_owner_token,now()+make_interval(secs=>p_seconds))
 on conflict(job_id) do update
 set owner_token=excluded.owner_token, acquired_at=now(), expires_at=excluded.expires_at
 where public.p4_research_leases.expires_at < now();
 get diagnostics v_rows = row_count;
 return v_rows=1;
end $$;
revoke all on function public.p4_claim_research_lease(text,text,integer) from public,anon,authenticated;
grant execute on function public.p4_claim_research_lease(text,text,integer) to service_role;
