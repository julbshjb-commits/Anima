-- Espace « Notes » : carnets personnels, notes, tags, et carnets de cours
-- partagés où chacun ajoute ses passages pendant la séance.
--
-- Règles :
--   * un carnet personnel n'est visible que de sa propriétaire et ne peut
--     jamais être partagé ;
--   * un carnet de cours est partagé uniquement par code d'invitation, comme
--     un journal ;
--   * dans une séance, chacun n'écrit et ne modifie que ses propres passages ;
--   * une tâche peut naître d'une note (« Transformer en tâche »), seulement
--     si on a accès à cette note.

create type public.notebook_kind as enum ('perso', 'cours');

-- ---------------------------------------------------------------------
-- Carnets et membres
-- ---------------------------------------------------------------------

create table public.notebooks (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind        public.notebook_kind not null default 'perso',
  title       text not null check (char_length(title) between 1 and 80),
  subtitle    text check (char_length(subtitle) <= 80),   -- « L2 · amphi B »
  cover       text not null default 'nature-sauge' check (char_length(cover) <= 40),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz
);
create index notebooks_owner_idx on public.notebooks (owner_id);

create table public.notebook_members (
  notebook_id uuid not null references public.notebooks (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        text not null default 'editor' check (role in ('owner', 'editor')),
  joined_at   timestamptz not null default now(),
  primary key (notebook_id, user_id)
);
create index notebook_members_user_idx on public.notebook_members (user_id);

create function public.notebooks_add_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notebook_members (notebook_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;
create trigger notebooks_add_owner after insert on public.notebooks
  for each row execute function public.notebooks_add_owner();

-- Le type ne change jamais ; le propriétaire seulement lors d'une
-- suppression de compte préparée (voir prepare_account_deletion).
create function public.notebooks_freeze_keys()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind <> old.kind then
    raise exception 'immutable_columns' using errcode = '42501';
  end if;
  if new.owner_id <> old.owner_id
     and coalesce(current_setting('anima.transfert_proprietaire', true), '') <> 'oui' then
    raise exception 'immutable_columns' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger notebooks_freeze before update on public.notebooks
  for each row execute function public.notebooks_freeze_keys();

create function public.notebook_role_of(p_notebook_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.notebook_members m
  where m.notebook_id = p_notebook_id and m.user_id = auth.uid();
$$;

create function public.is_notebook_member(p_notebook_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.notebook_role_of(p_notebook_id) is not null;
$$;

-- Deux personnes partagent-elles un carnet de cours ?
create function public.shares_a_notebook_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.notebook_members a
    join public.notebook_members b on b.notebook_id = a.notebook_id
    where a.user_id = auth.uid() and b.user_id = p_user_id
  );
$$;

-- ---------------------------------------------------------------------
-- Notes (dans un carnet de cours, une note est une séance)
-- ---------------------------------------------------------------------

create table public.notes (
  id           uuid primary key default gen_random_uuid(),
  notebook_id  uuid not null references public.notebooks (id) on delete cascade,
  -- set null : une séance commune survit à la suppression du compte de qui l'a ouverte.
  author_id    uuid default auth.uid() references public.profiles (id) on delete set null,
  title        text not null check (char_length(title) between 1 and 120),
  body         text not null default '' check (char_length(body) <= 100000),
  tags         text[] not null default '{}' check (cardinality(tags) <= 20),
  session_date date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index notes_notebook_idx on public.notes (notebook_id, updated_at desc);
create index notes_tags_idx on public.notes using gin (tags);

create function public.notes_freeze_keys()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.notebook_id <> old.notebook_id then
    raise exception 'immutable_columns' using errcode = '42501';
  end if;
  -- Seule la suppression d'un compte peut effacer l'auteur (on delete set null).
  if new.author_id is distinct from old.author_id and new.author_id is not null then
    raise exception 'immutable_columns' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger notes_freeze before update on public.notes
  for each row execute function public.notes_freeze_keys();

-- Passages d'une séance : chacun ajoute les siens, signés de son initiale.
create table public.note_blocks (
  id          uuid primary key default gen_random_uuid(),
  note_id     uuid not null references public.notes (id) on delete cascade,
  notebook_id uuid not null references public.notebooks (id) on delete cascade,
  author_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind        text not null default 'texte' check (kind in ('texte', 'question')),
  content     text not null check (char_length(content) between 1 and 20000),
  done_at     timestamptz,   -- question posée au prof
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index note_blocks_note_idx on public.note_blocks (note_id, created_at);
create index note_blocks_notebook_idx on public.note_blocks (notebook_id, created_at desc);

-- notebook_id recopié de la note, jamais choisi par le client.
create function public.note_blocks_set_notebook()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.note_id <> old.note_id or new.author_id <> old.author_id or new.kind <> old.kind then
      raise exception 'immutable_columns' using errcode = '42501';
    end if;
  end if;
  select n.notebook_id into new.notebook_id from public.notes n where n.id = new.note_id;
  if new.notebook_id is null then
    raise exception 'Note introuvable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger note_blocks_set_notebook before insert or update on public.note_blocks
  for each row execute function public.note_blocks_set_notebook();

-- Cocher une question posée : n'importe quel membre du carnet.
create function public.toggle_question(p_block_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_notebook uuid;
begin
  select b.notebook_id into v_notebook from public.note_blocks b
  where b.id = p_block_id and b.kind = 'question';
  if v_notebook is null or not public.is_notebook_member(v_notebook) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.note_blocks
  set done_at = case when done_at is null then now() else null end
  where id = p_block_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Tâche née d'une note
-- ---------------------------------------------------------------------

alter table public.tasks add column note_id uuid references public.notes (id) on delete set null;
create index tasks_note_idx on public.tasks (note_id) where note_id is not null;

create function public.tasks_check_note()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.note_id is not null and not exists (
    select 1 from public.notes n
    join public.notebook_members m on m.notebook_id = n.notebook_id
    where n.id = new.note_id and m.user_id = new.owner_id
  ) then
    raise exception 'Note introuvable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger tasks_check_note before insert or update of note_id, owner_id on public.tasks
  for each row execute function public.tasks_check_note();

-- ---------------------------------------------------------------------
-- Invitations aux carnets de cours (mêmes règles que les journaux)
-- ---------------------------------------------------------------------

create table public.notebook_invites (
  id          uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references public.notebooks (id) on delete cascade,
  created_by  uuid not null references public.profiles (id) on delete cascade,
  code_hash   text not null unique,
  expires_at  timestamptz not null default now() + interval '48 hours',
  max_uses    integer not null default 30 check (max_uses between 1 and 100),
  uses        integer not null default 0,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index notebook_invites_notebook_idx on public.notebook_invites (notebook_id);

create function public.create_notebook_invite(p_notebook_id uuid)
returns table (code text, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_kind public.notebook_kind;
  v_expires timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select n.kind into v_kind from public.notebooks n where n.id = p_notebook_id;
  if v_kind is null or not public.is_notebook_member(p_notebook_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_kind <> 'cours' then
    raise exception 'personal_notebook_cannot_be_shared' using errcode = '42501';
  end if;

  loop
    v_code := public.generate_invite_code();
    begin
      insert into public.notebook_invites (notebook_id, created_by, code_hash)
      values (p_notebook_id, auth.uid(), public.hash_invite_code(v_code))
      returning notebook_invites.expires_at into v_expires;
      exit;
    exception when unique_violation then
    end;
  end loop;
  return query select v_code, v_expires;
end;
$$;

-- Rejoint un journal OU un carnet de cours avec un code. Une seule
-- tentative comptée (5 par heure). Renvoie {"type": "journal"|"carnet", "id": …}
-- ou null si le code n'est pas valable.
create function public.join_with_code(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_hash text := public.hash_invite_code(p_code);
  v_recent int;
  v_j public.journal_invites%rowtype;
  v_n public.notebook_invites%rowtype;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select count(*) into v_recent from public.invite_attempts a
  where a.user_id = v_user and a.attempted_at > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'too_many_attempts' using errcode = '54000';
  end if;

  select * into v_j from public.journal_invites i
  where i.code_hash = v_hash and i.revoked_at is null and i.expires_at > now() and i.uses < i.max_uses
  for update;
  if found then
    insert into public.invite_attempts (user_id, succeeded) values (v_user, true);
    insert into public.journal_members (journal_id, user_id, role)
    values (v_j.journal_id, v_user, v_j.role)
    on conflict (journal_id, user_id) do nothing;
    if found then
      update public.journal_invites set uses = uses + 1 where id = v_j.id;
    end if;
    return jsonb_build_object('type', 'journal', 'id', v_j.journal_id);
  end if;

  select * into v_n from public.notebook_invites i
  where i.code_hash = v_hash and i.revoked_at is null and i.expires_at > now() and i.uses < i.max_uses
  for update;
  if found then
    insert into public.invite_attempts (user_id, succeeded) values (v_user, true);
    insert into public.notebook_members (notebook_id, user_id, role)
    values (v_n.notebook_id, v_user, 'editor')
    on conflict (notebook_id, user_id) do nothing;
    if found then
      update public.notebook_invites set uses = uses + 1 where id = v_n.id;
    end if;
    return jsonb_build_object('type', 'carnet', 'id', v_n.notebook_id);
  end if;

  insert into public.invite_attempts (user_id, succeeded) values (v_user, false);
  return null;
end;
$$;

create function public.leave_notebook(p_notebook_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if public.notebook_role_of(p_notebook_id) = 'owner' then
    raise exception 'owner_cannot_leave' using errcode = '42501';
  end if;
  delete from public.notebook_members
  where notebook_id = p_notebook_id and user_id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------
-- Suppression de compte : un carnet de cours partagé est transmis
-- ---------------------------------------------------------------------

create or replace function public.prepare_account_deletion()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  r record;
  v_heir uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  perform set_config('anima.transfert_proprietaire', 'oui', true);

  for r in select j.id from public.journals j where j.owner_id = v_me and j.kind <> 'intime' loop
    v_heir := null;
    select m.user_id into v_heir
    from public.journal_members m
    where m.journal_id = r.id and m.user_id <> v_me
    order by (m.role = 'reader'), m.joined_at
    limit 1;
    if v_heir is not null then
      update public.journals set owner_id = v_heir where id = r.id;
      update public.journal_members set role = 'owner' where journal_id = r.id and user_id = v_heir;
    end if;
  end loop;

  for r in select n.id from public.notebooks n where n.owner_id = v_me and n.kind = 'cours' loop
    v_heir := null;
    select m.user_id into v_heir
    from public.notebook_members m
    where m.notebook_id = r.id and m.user_id <> v_me
    order by m.joined_at
    limit 1;
    if v_heir is not null then
      update public.notebooks set owner_id = v_heir where id = r.id;
      update public.notebook_members set role = 'owner' where notebook_id = r.id and user_id = v_heir;
    end if;
  end loop;

  perform set_config('anima.transfert_proprietaire', '', true);
end;
$$;

-- ---------------------------------------------------------------------
-- updated_at, RLS et droits
-- ---------------------------------------------------------------------

create trigger notebooks_touch before update on public.notebooks
  for each row execute function public.touch_updated_at();
create trigger notes_touch before update on public.notes
  for each row execute function public.touch_updated_at();
create trigger note_blocks_touch before update on public.note_blocks
  for each row execute function public.touch_updated_at();

alter table public.notebooks        enable row level security;
alter table public.notebook_members enable row level security;
alter table public.notes            enable row level security;
alter table public.note_blocks      enable row level security;
alter table public.notebook_invites enable row level security;

-- Les membres d'un carnet de cours voient le nom des autres.
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_a_journal_with(id) or public.shares_a_notebook_with(id));

-- Carnets : visibles par leurs membres, gérés par la propriétaire.
create policy notebooks_select on public.notebooks for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_notebook_member(id));
create policy notebooks_insert on public.notebooks for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy notebooks_update on public.notebooks for update to authenticated
  using (public.notebook_role_of(id) = 'owner') with check (public.notebook_role_of(id) = 'owner');
create policy notebooks_delete on public.notebooks for delete to authenticated
  using (public.notebook_role_of(id) = 'owner');

-- Membres : ajoutés uniquement par fonctions (création, code d'invitation).
create policy notebook_members_select on public.notebook_members for select to authenticated
  using (public.is_notebook_member(notebook_id));
create policy notebook_members_delete on public.notebook_members for delete to authenticated
  using (public.notebook_role_of(notebook_id) = 'owner' and user_id <> (select auth.uid()));

-- Notes : lues par les membres ; créées par un membre en son nom ;
-- modifiées et supprimées par leur autrice, ou par la propriétaire du carnet.
create policy notes_select on public.notes for select to authenticated
  using (public.is_notebook_member(notebook_id));
create policy notes_insert on public.notes for insert to authenticated
  with check (author_id = (select auth.uid()) and public.is_notebook_member(notebook_id));
create policy notes_update on public.notes for update to authenticated
  using (author_id = (select auth.uid()) or public.notebook_role_of(notebook_id) = 'owner')
  with check (public.is_notebook_member(notebook_id));
create policy notes_delete on public.notes for delete to authenticated
  using (author_id = (select auth.uid()) or public.notebook_role_of(notebook_id) = 'owner');

-- Passages : lus par les membres ; chacun n'écrit que les siens.
create policy note_blocks_select on public.note_blocks for select to authenticated
  using (public.is_notebook_member(notebook_id));
create policy note_blocks_insert on public.note_blocks for insert to authenticated
  with check (author_id = (select auth.uid()) and public.is_notebook_member(notebook_id));
create policy note_blocks_update on public.note_blocks for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()) and public.is_notebook_member(notebook_id));
create policy note_blocks_delete on public.note_blocks for delete to authenticated
  using (author_id = (select auth.uid()));

-- Invitations : consultables par les membres ; créées par fonction.
create policy notebook_invites_select on public.notebook_invites for select to authenticated
  using (public.is_notebook_member(notebook_id));

grant select, insert, update, delete on public.notebooks to authenticated;
grant select, delete on public.notebook_members to authenticated;
grant select, insert, update, delete on public.notes to authenticated;
grant select, insert, update, delete on public.note_blocks to authenticated;
grant select on public.notebook_invites to authenticated;

-- Les fonctions sont fermées par défaut (migration 5) ; on ouvre le nécessaire.
grant execute on function public.notebook_role_of(uuid) to authenticated;
grant execute on function public.is_notebook_member(uuid) to authenticated;
grant execute on function public.shares_a_notebook_with(uuid) to authenticated;
grant execute on function public.toggle_question(uuid) to authenticated;
grant execute on function public.create_notebook_invite(uuid) to authenticated;
grant execute on function public.join_with_code(text) to authenticated;
grant execute on function public.leave_notebook(uuid) to authenticated;
revoke execute on function public.notebooks_add_owner() from public, anon, authenticated;
revoke execute on function public.notebooks_freeze_keys() from public, anon, authenticated;
revoke execute on function public.notes_freeze_keys() from public, anon, authenticated;
revoke execute on function public.note_blocks_set_notebook() from public, anon, authenticated;
revoke execute on function public.tasks_check_note() from public, anon, authenticated;

-- Temps réel : les passages d'une séance arrivent en direct chez les membres
-- (la RLS de note_blocks s'applique à chaque abonné).
alter publication supabase_realtime add table public.note_blocks;
