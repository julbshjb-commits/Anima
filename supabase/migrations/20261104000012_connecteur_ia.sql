-- Connecteur Anima pour les assistants IA (Claude, etc.), via le serveur
-- OAuth 2.1 de Supabase.
--
-- Un jeton émis pour une appli tierce porte la revendication « client_id ».
-- Avec ce jeton, la personne ne voit que les espaces qu'elle a cochés au moment
-- d'autoriser l'appli (table ai_access). Rien n'est coché par défaut, et le
-- journal intime est un choix à part (« intime »), distinct des journaux
-- partagés (« journaux »).
--
-- Le contrôle se fait par des politiques RESTRICTIVES ajoutées à chaque table :
-- elles s'ajoutent aux règles existantes sans rien ouvrir. Une session normale
-- (sans client_id) n'est pas concernée.

create table public.ai_access (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  spaces     text[] not null default '{}'
             check (spaces <@ array['journaux', 'intime', 'notes', 'organiser', 'cercles', 'bibliotheque', 'fichiers']::text[]),
  updated_at timestamptz not null default now()
);
alter table public.ai_access enable row level security;

create policy ai_access_own on public.ai_access for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Une appli tierce peut lire ce qu'on lui a ouvert, jamais le changer.
create policy ai_access_no_ai_insert on public.ai_access as restrictive for insert to authenticated
  with check ((auth.jwt() ->> 'client_id') is null);
create policy ai_access_no_ai_update on public.ai_access as restrictive for update to authenticated
  using ((auth.jwt() ->> 'client_id') is null) with check ((auth.jwt() ->> 'client_id') is null);
create policy ai_access_no_ai_delete on public.ai_access as restrictive for delete to authenticated
  using ((auth.jwt() ->> 'client_id') is null);

grant select, insert, update, delete on public.ai_access to authenticated;

-- Vrai pour une session normale ; pour une appli tierce, seulement si l'espace a été ouvert.
create function public.ai_allows(p_space text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (auth.jwt() ->> 'client_id') is null
      or exists (select 1 from public.ai_access a where a.user_id = auth.uid() and p_space = any (a.spaces));
$$;

-- Même chose pour un journal : « intime » ou « journaux » selon son type.
create function public.ai_allows_journal(p_journal_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (auth.jwt() ->> 'client_id') is null
      or public.ai_allows(case
           when (select j.kind from public.journals j where j.id = p_journal_id) = 'intime' then 'intime'
           else 'journaux' end);
$$;

revoke execute on function public.ai_allows(text), public.ai_allows_journal(uuid) from public, anon;
grant execute on function public.ai_allows(text), public.ai_allows_journal(uuid) to authenticated;

-- Une politique restrictive par table, selon l'espace.
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('projects', 'organiser'), ('tasks', 'organiser'), ('events', 'organiser'),
      ('rituals', 'organiser'), ('ritual_checks', 'organiser'),
      ('notebooks', 'notes'), ('notebook_members', 'notes'), ('notes', 'notes'),
      ('note_blocks', 'notes'), ('notebook_invites', 'notes'),
      ('circles', 'cercles'), ('circle_members', 'cercles'), ('circle_posts', 'cercles'),
      ('circle_reactions', 'cercles'), ('circle_comments', 'cercles'), ('circle_invites', 'cercles'),
      ('works', 'bibliotheque'), ('quotes', 'bibliotheque'), ('reading_goals', 'bibliotheque'),
      ('folders', 'fichiers'), ('files', 'fichiers')
    ) as v (tbl, space)
  loop
    execute format(
      'create policy ai_gate on public.%I as restrictive for all to authenticated using (public.ai_allows(%L)) with check (public.ai_allows(%L))',
      t.tbl, t.space, t.space);
  end loop;
end $$;

create policy ai_gate on public.journals as restrictive for all to authenticated
  using (public.ai_allows(case when kind = 'intime' then 'intime' else 'journaux' end))
  with check (public.ai_allows(case when kind = 'intime' then 'intime' else 'journaux' end));

do $$
declare
  t text;
begin
  foreach t in array array['journal_members', 'journal_entries', 'attachments', 'journal_invites'] loop
    execute format(
      'create policy ai_gate on public.%I as restrictive for all to authenticated using (public.ai_allows_journal(journal_id)) with check (public.ai_allows_journal(journal_id))',
      t);
  end loop;
end $$;

create policy ai_gate on public.entry_reads as restrictive for all to authenticated
  using (public.ai_allows_journal((select e.journal_id from public.journal_entries e where e.id = entry_id)))
  with check (public.ai_allows_journal((select e.journal_id from public.journal_entries e where e.id = entry_id)));

-- Photos des journaux et fichiers du disque.
create policy ai_gate on storage.objects as restrictive for all to authenticated
  using (case bucket_id
           when 'attachments' then public.ai_allows_journal(public.storage_journal_id(name))
           when 'fichiers' then public.ai_allows('fichiers')
           else true end)
  with check (case bucket_id
           when 'attachments' then public.ai_allows_journal(public.storage_journal_id(name))
           when 'fichiers' then public.ai_allows('fichiers')
           else true end);
