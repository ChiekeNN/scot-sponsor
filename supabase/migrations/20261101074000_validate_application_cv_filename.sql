-- Prevent misleading downloaded extensions even when the submission RPC is called directly.
alter table public.platform_job_applications add constraint platform_application_cv_extension
check ((cv_type = 'application/pdf' and cv_name ~* '[.]pdf$') or
       (cv_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' and cv_name ~* '[.]docx$'));
