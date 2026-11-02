-- =====================================================================
-- Anima — migration 1 : profils et journaux (cœur du lancement)
--
-- Principes (voir docs/adr/0002-acces-aux-donnees.md) :
--   * RLS activée sur toutes les tables, sans exception.
--   * Une donnée n'est lisible que par son propriétaire ou par les
--     membres actifs du journal concerné.
--   * Les opérations sensibles (rejoindre par code, créer un code,
--     changer un rôle) passent par des fonctions serveur, jamais par
--     une écriture directe du client.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------

create type public.journal_kind as enum (
  'intime',      -- journal intime : un seul membre, jamais d'invitation
  'couple', 'amis', 'famille', 'colocation',
  'voyage', 'gratitude', 'reves', 'lecture', 'projet'
);

create type public.journal_role as enum ('owner', 'editor', 'reader');

create type public.mood as enum (
  'lumineux', 'serein', 'tendre', 'pensif', 'fatigue', 'tendu', 'melancolique'
);

-- ---------------------------------------------------------------------
-- Profils
-- ---------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_path  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Crée le profil à l'inscription. Le nom vient des métadonnées
-- d'inscription, sinon de la partie locale de l'e-mail.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(coalesce(new.email, 'Anonyme'), '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Journaux et membres
-- ---------------------------------------------------------------------

create table public.journals (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 80),
  kind        public.journal_kind not null,
  cover       text not null default 'minimaliste-ivoire',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz
);

create index journals_owner_idx on public.journals (owner_id);

-- Un seul journal intime par personne.
create unique index journals_one_intime_per_user
  on public.journals (owner_id) where kind = 'intime';

create table public.journal_members (
  journal_id uuid not null references public.journals (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.journal_role not null default 'editor',
  joined_at  timestamptz not null default now(),
  primary key (journal_id, user_id)
);

create index journal_members_user_idx on public.journal_members (user_id);

-- Le créateur devient automatiquement propriétaire.
create function public.add_owner_as_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.journal_members (journal_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger journals_add_owner
  after insert on public.journals
  for each row execute function public.add_owner_as_member();

-- Rôle de l'utilisateur courant dans un journal (null s'il n'est pas membre).
-- security definer pour éviter la récursion des politiques RLS.
create function public.journal_role_of(p_journal_id uuid)
returns public.journal_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.journal_members m
  where m.journal_id = p_journal_id
    and m.user_id = auth.uid();
$$;

create function public.is_journal_member(p_journal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.journal_role_of(p_journal_id) is not null;
$$;

create function public.can_write_journal(p_journal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.journal_role_of(p_journal_id) in ('owner', 'editor'), false);
$$;

-- Deux personnes partagent-elles au moins un journal ?
create function public.shares_a_journal_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.journal_members a
    join public.journal_members b on b.journal_id = a.journal_id
    where a.user_id = auth.uid() and b.user_id = p_user_id
  );
$$;

-- ---------------------------------------------------------------------
-- Entrées
-- ---------------------------------------------------------------------

create table public.journal_entries (
  id           uuid primary key default gen_random_uuid(),
  journal_id   uuid not null references public.journals (id) on delete cascade,
  author_id    uuid not null references public.profiles (id) on delete cascade,
  entry_date   date not null default current_date,
  title        text check (char_length(title) <= 120),
  content      jsonb not null default '{}'::jsonb,      -- document Tiptap (ProseMirror JSON)
  content_text text not null default '' check (char_length(content_text) <= 50000), -- texte brut pour la recherche
  mood         public.mood,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index journal_entries_journal_date_idx
  on public.journal_entries (journal_id, entry_date desc)
  where deleted_at is null;
create index journal_entries_author_idx on public.journal_entries (author_id);

-- Accusés de lecture (« Lu par »).
create table public.entry_reads (
  entry_id uuid not null references public.journal_entries (id) on delete cascade,
  user_id  uuid not null references public.profiles (id) on delete cascade,
  read_at  timestamptz not null default now(),
  primary key (entry_id, user_id)
);

-- Pièces jointes : le fichier vit dans le bucket privé « attachments »,
-- au chemin {journal_id}/{entry_id}/{nom}. Servi par URL signée courte.
create table public.attachments (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  journal_id   uuid not null references public.journals (id) on delete cascade,
  entry_id     uuid references public.journal_entries (id) on delete cascade,
  storage_path text not null unique,
  mime_type    text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic')),
  size_bytes   integer not null check (size_bytes > 0 and size_bytes <= 10 * 1024 * 1024),
  created_at   timestamptz not null default now()
);

create index attachments_entry_idx on public.attachments (entry_id);

-- ---------------------------------------------------------------------
-- Invitations par code
-- ---------------------------------------------------------------------

create table public.journal_invites (
  id         uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.journals (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  code_hash  text not null unique,             -- sha256 du code : jamais stocké en clair
  role       public.journal_role not null default 'editor' check (role <> 'owner'),
  expires_at timestamptz not null default now() + interval '48 hours',
  max_uses   integer not null default 10 check (max_uses between 1 and 50),
  uses       integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index journal_invites_journal_idx on public.journal_invites (journal_id);

-- Tentatives pour limiter le débit (5 par heure et par personne).
create table public.invite_attempts (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  attempted_at timestamptz not null default now(),
  succeeded    boolean not null
);

create index invite_attempts_user_time_idx on public.invite_attempts (user_id, attempted_at desc);

-- Alphabet sans caractères ambigus (pas de 0/O, 1/I/L).
create function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text := '';
  bytes bytea := extensions.gen_random_bytes(6);
  i int;
begin
  for i in 0..5 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 31) + 1, 1);
  end loop;
  return code;
end;
$$;

create function public.hash_invite_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(upper(trim(p_code)), 'sha256'), 'hex');
$$;

-- Crée un code d'invitation. Réservé aux propriétaires et éditeurs ;
-- impossible pour un journal intime. Renvoie le code en clair une seule fois.
create function public.create_journal_invite(p_journal_id uuid)
returns table (code text, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_kind public.journal_kind;
  v_expires timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select j.kind into v_kind from public.journals j where j.id = p_journal_id;
  if v_kind is null or not public.can_write_journal(p_journal_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_kind = 'intime' then
    raise exception 'intime_journal_cannot_be_shared' using errcode = '42501';
  end if;

  -- Retente en cas de collision (très improbable : 31^6 ≈ 887 millions).
  loop
    v_code := public.generate_invite_code();
    begin
      insert into public.journal_invites (journal_id, created_by, code_hash)
      values (p_journal_id, auth.uid(), public.hash_invite_code(v_code))
      returning journal_invites.expires_at into v_expires;
      exit;
    exception when unique_violation then
      -- on recommence
    end;
  end loop;

  return query select v_code, v_expires;
end;
$$;

-- Rejoint un journal avec un code. Limité à 5 tentatives par heure.
-- Renvoie l'id du journal, ou null si le code n'est pas valable.
create function public.join_journal_with_code(p_code text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_invite public.journal_invites%rowtype;
  v_recent int;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select count(*) into v_recent
  from public.invite_attempts a
  where a.user_id = v_user and a.attempted_at > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'too_many_attempts' using errcode = '54000';
  end if;

  select * into v_invite
  from public.journal_invites i
  where i.code_hash = public.hash_invite_code(p_code)
    and i.revoked_at is null
    and i.expires_at > now()
    and i.uses < i.max_uses
  for update;

  if not found then
    -- Pas d'exception ici : elle annulerait l'enregistrement de la
    -- tentative, et la limite de débit ne compterait jamais les échecs.
    insert into public.invite_attempts (user_id, succeeded) values (v_user, false);
    return null;  -- code invalide, expiré, révoqué ou épuisé
  end if;

  insert into public.invite_attempts (user_id, succeeded) values (v_user, true);

  insert into public.journal_members (journal_id, user_id, role)
  values (v_invite.journal_id, v_user, v_invite.role)
  on conflict (journal_id, user_id) do nothing;

  if found then
    update public.journal_invites set uses = uses + 1 where id = v_invite.id;
  end if;

  return v_invite.journal_id;
end;
$$;

create function public.revoke_journal_invite(p_invite_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_journal uuid;
begin
  select i.journal_id into v_journal from public.journal_invites i where i.id = p_invite_id;
  if v_journal is null or not public.can_write_journal(v_journal) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.journal_invites set revoked_at = now()
  where id = p_invite_id and revoked_at is null;
end;
$$;

-- Quitter un journal (le propriétaire ne peut pas quitter : il supprime).
create function public.leave_journal(p_journal_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if public.journal_role_of(p_journal_id) = 'owner' then
    raise exception 'owner_cannot_leave' using errcode = '42501';
  end if;
  delete from public.journal_members
  where journal_id = p_journal_id and user_id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------
-- updated_at automatique
-- ---------------------------------------------------------------------

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger journals_touch before update on public.journals
  for each row execute function public.touch_updated_at();
create trigger entries_touch before update on public.journal_entries
  for each row execute function public.touch_updated_at();

-- Empêche de déplacer une entrée vers un autre journal ou de changer son auteur.
create function public.entries_freeze_keys()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.journal_id <> old.journal_id or new.author_id <> old.author_id then
    raise exception 'immutable_columns' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger entries_freeze before update on public.journal_entries
  for each row execute function public.entries_freeze_keys();

-- Empêche de changer le propriétaire ou le type d'un journal.
create function public.journals_freeze_keys()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id <> old.owner_id or new.kind <> old.kind then
    raise exception 'immutable_columns' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger journals_freeze before update on public.journals
  for each row execute function public.journals_freeze_keys();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.journals        enable row level security;
alter table public.journal_members enable row level security;
alter table public.journal_entries enable row level security;
alter table public.entry_reads     enable row level security;
alter table public.attachments     enable row level security;
alter table public.journal_invites enable row level security;
alter table public.invite_attempts enable row level security;

-- Profils : soi-même, ou les personnes avec qui on partage un journal.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_a_journal_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Journaux : visibles par les membres ; créés pour soi ; modifiés et
-- supprimés par le propriétaire uniquement.
-- owner_id = auth.uid() : nécessaire pour INSERT ... RETURNING, car le trigger
-- qui ajoute le propriétaire comme membre s'exécute après le contrôle RLS du RETURNING.
create policy journals_select on public.journals for select to authenticated
  using (owner_id = auth.uid() or public.is_journal_member(id));
create policy journals_insert on public.journals for insert to authenticated
  with check (owner_id = auth.uid());
create policy journals_update on public.journals for update to authenticated
  using (public.journal_role_of(id) = 'owner') with check (public.journal_role_of(id) = 'owner');
create policy journals_delete on public.journals for delete to authenticated
  using (public.journal_role_of(id) = 'owner');

-- Membres : visibles par les membres du même journal. Ajouts uniquement
-- par fonctions serveur (pas de politique insert). Le propriétaire peut
-- retirer quelqu'un d'autre que lui-même.
create policy members_select on public.journal_members for select to authenticated
  using (public.is_journal_member(journal_id));
create policy members_delete on public.journal_members for delete to authenticated
  using (public.journal_role_of(journal_id) = 'owner' and user_id <> auth.uid());

-- Entrées : lisibles par les membres ; écrites par owner/editor en leur
-- nom ; chacun ne modifie ou supprime que ses propres entrées.
create policy entries_select on public.journal_entries for select to authenticated
  using (deleted_at is null and public.is_journal_member(journal_id));
create policy entries_insert on public.journal_entries for insert to authenticated
  with check (author_id = auth.uid() and public.can_write_journal(journal_id));
create policy entries_update on public.journal_entries for update to authenticated
  using (author_id = auth.uid() and deleted_at is null)
  with check (author_id = auth.uid() and public.can_write_journal(journal_id));
create policy entries_delete on public.journal_entries for delete to authenticated
  using (author_id = auth.uid());

-- Accusés de lecture.
create policy reads_select on public.entry_reads for select to authenticated
  using (exists (
    select 1 from public.journal_entries e
    where e.id = entry_id and public.is_journal_member(e.journal_id)
  ));
create policy reads_insert on public.entry_reads for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from public.journal_entries e
    where e.id = entry_id and e.deleted_at is null and public.is_journal_member(e.journal_id)
  ));

-- Pièces jointes.
create policy attachments_select on public.attachments for select to authenticated
  using (public.is_journal_member(journal_id));
create policy attachments_insert on public.attachments for insert to authenticated
  with check (owner_id = auth.uid() and public.can_write_journal(journal_id));
create policy attachments_delete on public.attachments for delete to authenticated
  using (owner_id = auth.uid());

-- Invitations : consultables par ceux qui peuvent écrire dans le journal.
-- Création et révocation uniquement par fonctions.
create policy invites_select on public.journal_invites for select to authenticated
  using (public.can_write_journal(journal_id));

-- invite_attempts : aucune politique, donc aucun accès direct client.

-- ---------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on function public.create_journal_invite(uuid) from public, anon;
revoke all on function public.join_journal_with_code(text) from public, anon;
revoke all on function public.revoke_journal_invite(uuid) from public, anon;
revoke all on function public.leave_journal(uuid) from public, anon;
revoke all on function public.generate_invite_code() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.add_owner_as_member() from public, anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.journals to authenticated;
grant select, delete on public.journal_members to authenticated;
grant select, insert, update, delete on public.journal_entries to authenticated;
grant select, insert on public.entry_reads to authenticated;
grant select, insert, delete on public.attachments to authenticated;
grant select on public.journal_invites to authenticated;
grant execute on function public.create_journal_invite(uuid) to authenticated;
grant execute on function public.join_journal_with_code(text) to authenticated;
grant execute on function public.revoke_journal_invite(uuid) to authenticated;
grant execute on function public.leave_journal(uuid) to authenticated;
