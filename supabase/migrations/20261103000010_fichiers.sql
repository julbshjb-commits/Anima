-- Espace « Fichiers » : un disque privé (dossiers, fichiers, favoris,
-- corbeille), et des fichiers joints aux séances de cours et aux cercles.
--
-- Règles :
--   * Un fichier appartient à une seule personne. Personne d'autre ne le voit,
--     sauf si sa propriétaire l'a elle-même joint à un passage de séance
--     (carnet de cours) ou à une publication de cercle : les membres de ce
--     carnet ou de ce cercle peuvent alors le lire, et seulement le lire.
--   * Un fichier mis à la corbeille n'est plus visible que de sa propriétaire.
--   * Bucket privé « fichiers », chemin imposé {owner_id}/{fichier}. Pas
--     d'URL publique : tout passe par des URL signées de courte durée.
--   * Taille et type viennent du stockage, jamais du client.
--   * Quota par personne : public.file_quota_bytes().

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fichiers', 'fichiers', false, 26214400, array[
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif',
  'text/plain', 'text/markdown', 'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation'
])
on conflict (id) do nothing;

-- 2 Go par personne pour le lancement.
create function public.file_quota_bytes()
returns bigint
language sql
immutable
set search_path = ''
as $$ select 2147483648::bigint $$;

-- Place occupée par la personne connectée (objets réellement stockés).
create function public.storage_used_bytes()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0)::bigint
  from storage.objects o
  where o.bucket_id = 'fichiers' and o.owner_id = (auth.uid())::text
$$;

-- ---------------------------------------------------------------------
-- Dossiers et fichiers
-- ---------------------------------------------------------------------

create table public.folders (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  parent_id  uuid references public.folders (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index folders_owner_idx on public.folders (owner_id, parent_id);

create table public.files (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  folder_id    uuid references public.folders (id) on delete set null,
  name         text not null check (char_length(name) between 1 and 200),
  storage_path text not null unique check (char_length(storage_path) <= 300),
  mime_type    text not null default 'application/octet-stream',
  size_bytes   bigint not null default 0,
  starred      boolean not null default false,
  note_id      uuid references public.notes (id) on delete set null,   -- « Lier à une note »
  trashed_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index files_owner_idx on public.files (owner_id, folder_id, updated_at desc);
create index files_note_idx on public.files (note_id) where note_id is not null;

-- Un dossier ne peut être rangé que dans un de ses propres dossiers, et ne
-- se déplace pas (pas de boucle possible).
create function public.folders_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.owner_id <> old.owner_id or new.parent_id is distinct from old.parent_id) then
    raise exception 'immutable_columns' using errcode = '42501';
  end if;
  if new.parent_id is not null and not exists (
    select 1 from public.folders f where f.id = new.parent_id and f.owner_id = new.owner_id
  ) then
    raise exception 'Dossier introuvable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger folders_check before insert or update on public.folders
  for each row execute function public.folders_check();

-- À la création, le fichier doit déjà être dans le stockage, dans le dossier
-- de la personne, à son nom : taille et type sont lus depuis le stockage.
-- Ensuite, chemin, taille, type et propriétaire ne changent plus.
create function public.files_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_meta jsonb;
begin
  if tg_op = 'INSERT' then
    if v_me is null or new.owner_id <> v_me
       or (storage.foldername(new.storage_path))[1] is distinct from v_me::text then
      raise exception 'Chemin interdit' using errcode = '42501';
    end if;
    select o.metadata into v_meta from storage.objects o
    where o.bucket_id = 'fichiers' and o.name = new.storage_path and o.owner_id = v_me::text;
    if not found then
      raise exception 'Fichier introuvable dans le stockage' using errcode = '42501';
    end if;
    new.size_bytes := coalesce((v_meta ->> 'size')::bigint, 0);
    new.mime_type := coalesce(nullif(v_meta ->> 'mimetype', ''), 'application/octet-stream');
  else
    if new.owner_id <> old.owner_id or new.storage_path <> old.storage_path
       or new.size_bytes <> old.size_bytes or new.mime_type <> old.mime_type then
      raise exception 'immutable_columns' using errcode = '42501';
    end if;
  end if;
  if new.folder_id is not null and not exists (
    select 1 from public.folders f where f.id = new.folder_id and f.owner_id = new.owner_id
  ) then
    raise exception 'Dossier introuvable' using errcode = '42501';
  end if;
  -- Lier à une note : seulement une note que la propriétaire peut lire.
  if new.note_id is not null and (tg_op = 'INSERT' or new.note_id is distinct from old.note_id) then
    if not exists (
      select 1 from public.notes n
      join public.notebook_members m on m.notebook_id = n.notebook_id and m.user_id = new.owner_id
      where n.id = new.note_id
    ) then
      raise exception 'Note introuvable' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger files_check before insert or update on public.files
  for each row execute function public.files_check();

create trigger folders_touch before update on public.folders
  for each row execute function public.touch_updated_at();
create trigger files_touch before update on public.files
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Fichiers joints : passages de séance et publications de cercle
-- ---------------------------------------------------------------------

alter table public.note_blocks add column file_id uuid references public.files (id) on delete set null;
alter table public.note_blocks drop constraint note_blocks_content_check;
alter table public.note_blocks add constraint note_blocks_content_check
  check (char_length(content) <= 20000 and (char_length(content) >= 1 or file_id is not null));
create index note_blocks_file_idx on public.note_blocks (file_id) where file_id is not null;

alter table public.circle_posts add column file_id uuid references public.files (id) on delete set null;
alter table public.circle_posts drop constraint circle_posts_check;
alter table public.circle_posts add constraint circle_posts_check
  check (body <> '' or event_title is not null or quote_text is not null or file_id is not null);
create index circle_posts_file_idx on public.circle_posts (file_id) where file_id is not null;

-- On ne joint que ses propres fichiers (hors corbeille), et une pièce jointe
-- ne se remplace pas après coup (elle peut seulement disparaître si le
-- fichier est supprimé).
create function public.attachment_check_file()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.file_id is not null and new.file_id is distinct from old.file_id then
    raise exception 'immutable_columns' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and new.file_id is not null and not exists (
    select 1 from public.files f
    where f.id = new.file_id and f.owner_id = auth.uid() and f.owner_id = new.author_id and f.trashed_at is null
  ) then
    raise exception 'Fichier introuvable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger note_blocks_check_file before insert or update of file_id on public.note_blocks
  for each row execute function public.attachment_check_file();
create trigger circle_posts_check_file before insert or update of file_id on public.circle_posts
  for each row execute function public.attachment_check_file();

-- Supprimer un fichier retire aussi les publications et passages qui
-- n'étaient que ce fichier (ils appartiennent à la même personne).
create function public.files_before_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.circle_posts p
  where p.file_id = old.id and p.body = '' and p.event_title is null and p.quote_text is null;
  delete from public.note_blocks b where b.file_id = old.id and b.content = '';
  return old;
end;
$$;
create trigger files_before_delete before delete on public.files
  for each row execute function public.files_before_delete();

-- Un fichier est lisible par sa propriétaire, ou par les membres du carnet
-- ou du cercle où elle l'a joint, tant qu'il n'est pas à la corbeille.
create function public.can_read_file(p_file_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.files f
    where f.id = p_file_id
      and (
        f.owner_id = auth.uid()
        or (f.trashed_at is null and (
          exists (select 1 from public.note_blocks b
                  where b.file_id = f.id and public.is_notebook_member(b.notebook_id))
          or exists (select 1 from public.circle_posts p
                     where p.file_id = f.id and public.is_circle_member(p.circle_id))
        ))
      )
  )
$$;

create function public.can_read_file_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.files f where f.storage_path = p_name and public.can_read_file(f.id))
$$;

-- ---------------------------------------------------------------------
-- Règles d'accès
-- ---------------------------------------------------------------------

alter table public.folders enable row level security;
alter table public.files   enable row level security;

create policy folders_own on public.folders for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy files_select on public.files for select to authenticated
  using (owner_id = (select auth.uid()) or public.can_read_file(id));
create policy files_insert on public.files for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy files_update on public.files for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy files_delete on public.files for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy fichiers_read on storage.objects for select to authenticated
  using (bucket_id = 'fichiers'
         and (owner_id = (auth.uid())::text or public.can_read_file_object(name)));
create policy fichiers_write on storage.objects for insert to authenticated
  with check (bucket_id = 'fichiers'
              and owner_id = (auth.uid())::text
              and (storage.foldername(name))[1] = (auth.uid())::text
              and public.storage_used_bytes() < public.file_quota_bytes());
create policy fichiers_remove on storage.objects for delete to authenticated
  using (bucket_id = 'fichiers' and owner_id = (auth.uid())::text);

grant select, insert, update, delete on public.folders, public.files to authenticated;
grant execute on function public.file_quota_bytes() to authenticated;
grant execute on function public.storage_used_bytes() to authenticated;
grant execute on function public.can_read_file(uuid) to authenticated;
grant execute on function public.can_read_file_object(text) to authenticated;
revoke execute on function public.folders_check() from public, anon, authenticated;
revoke execute on function public.files_check() from public, anon, authenticated;
revoke execute on function public.attachment_check_file() from public, anon, authenticated;
revoke execute on function public.files_before_delete() from public, anon, authenticated;
revoke execute on function public.file_quota_bytes() from public, anon;
revoke execute on function public.storage_used_bytes() from public, anon;
revoke execute on function public.can_read_file(uuid) from public, anon;
revoke execute on function public.can_read_file_object(text) from public, anon;
