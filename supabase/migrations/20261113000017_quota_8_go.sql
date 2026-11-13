-- 8 Go de fichiers par personne, gratuitement (décision de Nassim, 2026-11-13).
create or replace function public.file_quota_bytes()
returns bigint
language sql
immutable
set search_path = ''
as $$ select 8589934592::bigint $$;
