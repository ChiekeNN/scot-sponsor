-- Show unreviewed requests first, oldest first, so the 200-row limit does not hide pending work.
create or replace function public.admin_application_support_requests()
returns table(id uuid,applicant_name text,applicant_email text,job_title text,employer text,location text,created_at timestamptz,reviewed_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 return query select r.id,r.applicant_name,r.applicant_email,r.job_title,r.employer,r.location,r.created_at,r.reviewed_at
 from public.application_support_requests r where r.created_at >= now()-interval '90 days' order by (r.reviewed_at is not null),r.created_at asc limit 200;
end; $$;
