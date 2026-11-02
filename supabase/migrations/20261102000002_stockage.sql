-- =====================================================================
-- Anima — migration 2 : stockage privé des photos des journaux
--
-- Bucket privé « attachments ». Chemin imposé :
--   {journal_id}/{entry_id}/{nom_du_fichier}
-- Lecture : membres du journal. Écriture : owner/editor du journal,
-- dans leur propre dossier d'entrée. Aucun accès public : les images
-- sont servies par URL signée de courte durée.
-- owner_id (texte) est la colonne de propriétaire actuelle de Supabase Storage.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

-- Premier segment du chemin = journal ; renvoie null si ce n'est pas un uuid.
create function public.storage_journal_id(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return (storage.foldername(p_name))[1]::uuid;
exception when others then
  return null;
end;
$$;

create policy attachments_read on storage.objects for select to authenticated
  using (bucket_id = 'attachments'
         and public.is_journal_member(public.storage_journal_id(name)));

create policy attachments_write on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments'
              and owner_id = (auth.uid())::text
              and public.can_write_journal(public.storage_journal_id(name)));

create policy attachments_remove on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and owner_id = (auth.uid())::text);
