-- Fenced checkpoint update: only the active owner can update a leased job.
create or replace function public.p4_save_leased_checkpoint(p_job_id text,p_owner_token text,p_checkpoint jsonb)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
 if jsonb_typeof(p_checkpoint)<>'object' or p_checkpoint->>'jobId' is distinct from p_job_id then
  raise exception 'invalid P4 checkpoint payload';
 end if;
 perform 1 from public.p4_research_leases
 where job_id=p_job_id and owner_token=p_owner_token and expires_at>now() for update;
 if not found then raise exception 'P4 research lease not owned or expired'; end if;
 insert into public.p4_research_checkpoints(job_id,checkpoint,updated_at)
 values(p_job_id,p_checkpoint,now())
 on conflict(job_id) do update set checkpoint=excluded.checkpoint,updated_at=now();
 return true;
end $$;
revoke all on function public.p4_save_leased_checkpoint(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.p4_save_leased_checkpoint(text,text,jsonb) to service_role;
