-- The importer is service-only. Its cron token is generated and retained in Vault.
select vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'scotland_job_import_token','Authorises the Scottish job importer')
where not exists(select 1 from vault.secrets where name='scotland_job_import_token');
create table public.scotland_job_import_state (
 id boolean primary key default true check(id), page integer not null default 0 check(page between 0 and 100),
 offset_in_page integer not null default 0 check(offset_in_page between 0 and 100),
 blocked_until timestamptz, last_started timestamptz, last_finished timestamptz,
 last_result text, imported integer not null default 0
);
insert into public.scotland_job_import_state(id) values(true);
alter table public.scotland_job_import_state enable row level security;
revoke all on public.scotland_job_import_state from public,anon,authenticated;
grant all on public.scotland_job_import_state to service_role;
create function public.scotland_job_import_authorise(p_token text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(length(p_token)=64 and p_token=(select decrypted_secret from vault.decrypted_secrets where name='scotland_job_import_token' limit 1),false);
$$;
create function public.scotland_job_import_claim() returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.scotland_job_import_state%rowtype;
begin
 update public.scotland_job_import_state set last_started=clock_timestamp(),last_result='running'
 where id=true and (blocked_until is null or blocked_until<clock_timestamp())
 and (last_started is null or last_started<clock_timestamp()-interval '90 seconds') returning * into s;
 if not found then return null; end if;
 return jsonb_build_object('page',s.page,'offset',s.offset_in_page);
end $$;
create function public.scotland_job_import_finish(p_page integer,p_offset integer,p_imported integer,p_result text,p_block_seconds integer default 0) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_page not between 0 and 100 or p_offset not between 0 and 100 or p_imported not between 0 and 25 or p_result not in ('ok','partial','upstream_error','rate_limited','parse_error') then raise exception 'invalid status'; end if;
 update public.scotland_job_import_state set page=p_page,offset_in_page=p_offset,last_finished=clock_timestamp(),last_result=p_result,imported=imported+p_imported,
 blocked_until=case when p_block_seconds>0 then clock_timestamp()+least(greatest(p_block_seconds,1800),86400)*interval '1 second' else null end where id=true;
 if p_result<>'ok' and p_result<>'partial' then update public.partner_job_sync_status set last_attempt=clock_timestamp(),last_error='SYNC_FAILED' where source='myjobscotland'; end if;
end $$;
create function public.save_scottish_job(p_job jsonb) returns text language plpgsql security definer set search_path='' as $$
declare j public.partner_jobs%rowtype; fp text; current_time timestamptz:=clock_timestamp(); p_id text:=p_job->>'external_id';
 p_title text:=trim(p_job->>'title'); p_employer text:=trim(p_job->>'employer'); p_location text:=trim(p_job->>'location');
 p_desc text:=trim(p_job->>'description'); p_url text:=p_job->>'source_url'; p_excerpt text; p_posted timestamptz; p_expires timestamptz;
begin
 if p_id !~ '^\d{1,12}$' or length(p_title) not between 2 and 200 or length(p_employer) not between 2 and 200 or length(p_location) not between 2 and 200
 or length(p_desc) not between 120 and 30000 or p_desc ~ '(\.\.\.|…)$' or lower(p_desc) like '%adzuna%'
 or p_url !~ ('^https://myjobscotland[.]gov[.]uk/councils/[a-z0-9-]+/jobs/[a-z0-9-]+-'||p_id||'$') then return 'invalid'; end if;
 begin p_posted:=(p_job->>'posted_at')::timestamptz; p_expires:=(p_job->>'expires_at')::timestamptz; exception when others then return 'invalid'; end;
 if p_posted is null or p_posted>current_time or p_posted<current_time-interval '14 days' or p_expires is null or p_expires<=current_time then return 'stale'; end if;
 p_excerpt:=left(regexp_replace(p_desc,'\s+',' ','g'),190);
 insert into public.partner_jobs(source,external_id,title,description,employer,location,location_search,posted_at,source_url,last_seen,expires_at)
 values('myjobscotland',p_id,p_title,p_excerpt,p_employer,p_location,concat_ws(', ',p_location,'Scotland'),p_posted,p_url,current_time,p_expires)
 on conflict(source,external_id) do update set title=excluded.title,description=excluded.description,employer=excluded.employer,location=excluded.location,location_search=excluded.location_search,
 posted_at=excluded.posted_at,source_url=excluded.source_url,last_seen=excluded.last_seen,expires_at=excluded.expires_at returning * into j;
 fp:=public.job_listing_fingerprint(j.title,j.employer,j.location,j.description);
 if not exists(select 1 from public.partner_detail_exclusions where job_id=j.public_id and listing_fingerprint=fp) then
 insert into public.job_complete_descriptions(job_id,description,listing_fingerprint,updated_by,updated_at,origin)
 values(j.public_id,p_desc,fp,null,current_time,'provider')
 on conflict(job_id) do update set description=excluded.description,listing_fingerprint=excluded.listing_fingerprint,updated_by=null,updated_at=excluded.updated_at,origin='provider'
 where public.job_complete_descriptions.origin='provider';
 end if;
 insert into public.partner_job_sync_status(source,last_success,last_attempt,last_error,count,truncated)
 values('myjobscotland',current_time,current_time,null,1,true)
 on conflict(source) do update set last_success=excluded.last_success,last_attempt=excluded.last_attempt,last_error=null,count=(select count(*) from public.partner_jobs where source='myjobscotland'),truncated=true;
 return 'saved';
end $$;
revoke all on function public.scotland_job_import_authorise(text),public.scotland_job_import_claim(),public.scotland_job_import_finish(integer,integer,integer,text,integer),public.save_scottish_job(jsonb) from public,anon,authenticated;
grant execute on function public.scotland_job_import_authorise(text),public.scotland_job_import_claim(),public.scotland_job_import_finish(integer,integer,integer,text,integer),public.save_scottish_job(jsonb) to service_role;
