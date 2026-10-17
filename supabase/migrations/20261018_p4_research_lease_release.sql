-- Lease release is owner-scoped. A stale worker cannot release a newer owner's lease.
create or replace function public.p4_release_research_lease(p_job_id text,p_owner_token text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare v_rows integer;
begin
 delete from public.p4_research_leases where job_id=p_job_id and owner_token=p_owner_token;
 get diagnostics v_rows = row_count;
 return v_rows=1;
end $$;
revoke all on function public.p4_release_research_lease(text,text) from public,anon,authenticated;
grant execute on function public.p4_release_research_lease(text,text) to service_role;
