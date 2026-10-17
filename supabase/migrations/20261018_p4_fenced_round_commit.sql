-- Fenced P4 round commit: validate the current lease owner in the same transaction
-- as the immutable insert. Old workers cannot commit after lease takeover.
create or replace function public.p4_commit_research_round(
 p_job_id text,p_owner_token text,p_iteration integer,
 p_spec_fingerprint text,p_round_result jsonb)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
 if p_iteration<1 or p_iteration>100 or p_spec_fingerprint !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_round_result)<>'object'
    or (p_round_result->>'iteration')::integer is distinct from p_iteration then
  raise exception 'invalid P4 research round';
 end if;
 -- Row lock serializes lease takeovers with round writes.
 perform 1 from public.p4_research_leases
 where job_id=p_job_id and owner_token=p_owner_token and expires_at>now()
 for update;
 if not found then raise exception 'P4 research lease not owned or expired'; end if;
 insert into public.p4_research_rounds(job_id,iteration,spec_fingerprint,round_result)
 values(p_job_id,p_iteration,p_spec_fingerprint,p_round_result);
 return true;
end $$;
revoke all on function public.p4_commit_research_round(text,text,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.p4_commit_research_round(text,text,integer,text,jsonb) to service_role;
