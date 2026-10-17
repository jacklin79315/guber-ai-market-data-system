-- Renew only the current owner's active lease.
create or replace function public.p4_renew_research_lease(p_job_id text,p_owner_token text,p_seconds integer default 900)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare v_rows integer;
begin
 if p_seconds<30 or p_seconds>3600 then raise exception 'invalid P4 lease duration'; end if;
 update public.p4_research_leases
 set expires_at=now()+make_interval(secs=>p_seconds)
 where job_id=p_job_id and owner_token=p_owner_token and expires_at>now();
 get diagnostics v_rows = row_count;
 return v_rows=1;
end $$;
revoke all on function public.p4_renew_research_lease(text,text,integer) from public,anon,authenticated;
grant execute on function public.p4_renew_research_lease(text,text,integer) to service_role;
