-- Source-verified open jobs may have been posted more than 14 days ago.
-- Keep all existing source-observation, expiry, fingerprint and full-text guards.
do $$
declare f regprocedure; def text;
begin
 foreach f in array array['public.is_current_partner_job(uuid)'::regprocedure,'public.public_job_list(integer,integer)'::regprocedure,'public.public_job_detail(uuid)'::regprocedure,'public.public_job_search(integer,integer,text,text,text,text[],text[],boolean,uuid[])'::regprocedure] loop
  def:=pg_get_functiondef(f);
  if position('j.posted_at>=now()-interval ''14 days'' and j.posted_at<=now()' in def)=0 then raise exception 'unexpected function definition: %',f; end if;
  execute replace(def,'j.posted_at>=now()-interval ''14 days'' and j.posted_at<=now()','j.posted_at<=now()');
 end loop;
end $$;
