-- Espace « Cercles » : petits groupes privés (amis, coloc, famille) où l'on
-- partage un mot, un événement ou une citation.
--
-- Règles :
--   * on n'entre dans un cercle que par code d'invitation ; personne ne te
--     trouve par hasard, il n'y a ni recherche ni profil public ;
--   * une publication reste dans son cercle ;
--   * chacun modifie ses publications ; la créatrice du cercle peut retirer
--     une publication ou un commentaire (modération) ;
--   * « Ajouter à mon agenda » copie l'événement dans M'organiser, à soi seul.

-- ---------------------------------------------------------------------
-- Cercles et membres
-- ---------------------------------------------------------------------

create table public.circles (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  color      text not null default 'serein' check (color in ('lumineux','serein','tendre','pensif','fatigue','tendu','melancolique')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index circles_owner_idx on public.circles (owner_id);

create table public.circle_members (
  circle_id    uuid not null references public.circles (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  joined_at    timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);
create index circle_members_user_idx on public.circle_members (user_id);

create function public.circles_add_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.circle_members (circle_id, user_id, role) values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;
create trigger circles_add_owner after insert on public.circles
  for each row execute function public.circles_add_owner();

create function public.circles_freeze_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id <> old.owner_id
     and coalesce(current_setting('anima.transfert_proprietaire', true), '') <> 'oui' then
    raise exception 'immutable_columns' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger circles_freeze before update on public.circles
  for each row execute function public.circles_freeze_owner();

create function public.circle_role_of(p_circle_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.circle_members m where m.circle_id = p_circle_id and m.user_id = auth.uid();
$$;

create function public.is_circle_member(p_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.circle_role_of(p_circle_id) is not null;
$$;

create function public.shares_a_circle_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.circle_members a
    join public.circle_members b on b.circle_id = a.circle_id
    where a.user_id = auth.uid() and b.user_id = p_user_id
  );
$$;

-- ---------------------------------------------------------------------
-- Publications, réactions, commentaires
-- ---------------------------------------------------------------------

create table public.circle_posts (
  id            uuid primary key default gen_random_uuid(),
  circle_id     uuid not null references public.circles (id) on delete cascade,
  author_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body          text not null default '' check (char_length(body) <= 5000),
  -- Événement proposé (« Week-end à Strasbourg, 12 et 13 décembre »)
  event_title   text check (char_length(event_title) between 1 and 120),
  event_day     date,
  event_end_day date,
  event_time    time,
  event_place   text check (char_length(event_place) <= 120),
  -- Citation (« Chaque homme porte la forme entière… », Montaigne)
  quote_text    text check (char_length(quote_text) between 1 and 1000),
  quote_source  text check (char_length(quote_source) <= 200),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (body <> '' or event_title is not null or quote_text is not null),
  check ((event_title is null) = (event_day is null)),
  check (event_end_day is null or (event_day is not null and event_end_day >= event_day))
);
create index circle_posts_circle_idx on public.circle_posts (circle_id, created_at desc);

create function public.circle_posts_freeze_keys()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.circle_id <> old.circle_id or new.author_id <> old.author_id then
    raise exception 'immutable_columns' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger circle_posts_freeze before update on public.circle_posts
  for each row execute function public.circle_posts_freeze_keys();

create table public.circle_reactions (
  post_id    uuid not null references public.circle_posts (id) on delete cascade,
  circle_id  uuid not null references public.circles (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('coeur', 'jensuis')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, kind)
);
create index circle_reactions_circle_idx on public.circle_reactions (circle_id);

create table public.circle_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.circle_posts (id) on delete cascade,
  circle_id  uuid not null references public.circles (id) on delete cascade,
  author_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index circle_comments_post_idx on public.circle_comments (post_id, created_at);

-- circle_id recopié de la publication, jamais choisi par le client.
create function public.circle_child_set_circle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select p.circle_id into new.circle_id from public.circle_posts p where p.id = new.post_id;
  if new.circle_id is null then
    raise exception 'Publication introuvable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger circle_reactions_set_circle before insert on public.circle_reactions
  for each row execute function public.circle_child_set_circle();
create trigger circle_comments_set_circle before insert on public.circle_comments
  for each row execute function public.circle_child_set_circle();

-- ---------------------------------------------------------------------
-- « Ajouter à mon agenda » : un rendez-vous perso né d'une publication
-- ---------------------------------------------------------------------

alter table public.events add column circle_post_id uuid references public.circle_posts (id) on delete set null;
create unique index events_owner_post_idx on public.events (owner_id, circle_post_id) where circle_post_id is not null;

create function public.events_check_post()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.circle_post_id is not null and not exists (
    select 1 from public.circle_posts p
    join public.circle_members m on m.circle_id = p.circle_id
    where p.id = new.circle_post_id and m.user_id = new.owner_id
  ) then
    raise exception 'Publication introuvable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger events_check_post before insert or update of circle_post_id, owner_id on public.events
  for each row execute function public.events_check_post();

-- « Vu » : remet à zéro les nouveautés d'un cercle (ou de tous).
create function public.mark_circles_seen(p_circle_id uuid default null)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.circle_members set last_seen_at = now()
  where user_id = auth.uid() and (p_circle_id is null or circle_id = p_circle_id);
$$;

-- ---------------------------------------------------------------------
-- Invitations (code de 6 caractères, comme les journaux)
-- ---------------------------------------------------------------------

create table public.circle_invites (
  id         uuid primary key default gen_random_uuid(),
  circle_id  uuid not null references public.circles (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  code_hash  text not null unique,
  expires_at timestamptz not null default now() + interval '48 hours',
  max_uses   integer not null default 20 check (max_uses between 1 and 50),
  uses       integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index circle_invites_circle_idx on public.circle_invites (circle_id);

create function public.create_circle_invite(p_circle_id uuid)
returns table (code text, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_expires timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not public.is_circle_member(p_circle_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  loop
    v_code := public.generate_invite_code();
    begin
      insert into public.circle_invites (circle_id, created_by, code_hash)
      values (p_circle_id, auth.uid(), public.hash_invite_code(v_code))
      returning circle_invites.expires_at into v_expires;
      exit;
    exception when unique_violation then
    end;
  end loop;
  return query select v_code, v_expires;
end;
$$;

-- Le même écran « Rejoindre avec un code » ouvre un journal, un carnet de
-- cours ou un cercle. Une seule tentative comptée (5 par heure).
create or replace function public.join_with_code(p_code text)
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
  v_c public.circle_invites%rowtype;
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

  select * into v_c from public.circle_invites i
  where i.code_hash = v_hash and i.revoked_at is null and i.expires_at > now() and i.uses < i.max_uses
  for update;
  if found then
    insert into public.invite_attempts (user_id, succeeded) values (v_user, true);
    insert into public.circle_members (circle_id, user_id, role)
    values (v_c.circle_id, v_user, 'member')
    on conflict (circle_id, user_id) do nothing;
    if found then
      update public.circle_invites set uses = uses + 1 where id = v_c.id;
    end if;
    return jsonb_build_object('type', 'cercle', 'id', v_c.circle_id);
  end if;

  insert into public.invite_attempts (user_id, succeeded) values (v_user, false);
  return null;
end;
$$;

create function public.leave_circle(p_circle_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if public.circle_role_of(p_circle_id) = 'owner' then
    raise exception 'owner_cannot_leave' using errcode = '42501';
  end if;
  delete from public.circle_members where circle_id = p_circle_id and user_id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------
-- Suppression de compte : un cercle est transmis au membre le plus ancien
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
    select m.user_id into v_heir from public.journal_members m
    where m.journal_id = r.id and m.user_id <> v_me
    order by (m.role = 'reader'), m.joined_at limit 1;
    if v_heir is not null then
      update public.journals set owner_id = v_heir where id = r.id;
      update public.journal_members set role = 'owner' where journal_id = r.id and user_id = v_heir;
    end if;
  end loop;

  for r in select n.id from public.notebooks n where n.owner_id = v_me and n.kind = 'cours' loop
    v_heir := null;
    select m.user_id into v_heir from public.notebook_members m
    where m.notebook_id = r.id and m.user_id <> v_me
    order by m.joined_at limit 1;
    if v_heir is not null then
      update public.notebooks set owner_id = v_heir where id = r.id;
      update public.notebook_members set role = 'owner' where notebook_id = r.id and user_id = v_heir;
    end if;
  end loop;

  for r in select c.id from public.circles c where c.owner_id = v_me loop
    v_heir := null;
    select m.user_id into v_heir from public.circle_members m
    where m.circle_id = r.id and m.user_id <> v_me
    order by m.joined_at limit 1;
    if v_heir is not null then
      update public.circles set owner_id = v_heir where id = r.id;
      update public.circle_members set role = 'owner' where circle_id = r.id and user_id = v_heir;
    end if;
  end loop;

  perform set_config('anima.transfert_proprietaire', '', true);
end;
$$;

-- ---------------------------------------------------------------------
-- updated_at, RLS et droits
-- ---------------------------------------------------------------------

create trigger circles_touch before update on public.circles
  for each row execute function public.touch_updated_at();
create trigger circle_posts_touch before update on public.circle_posts
  for each row execute function public.touch_updated_at();

alter table public.circles          enable row level security;
alter table public.circle_members   enable row level security;
alter table public.circle_posts     enable row level security;
alter table public.circle_reactions enable row level security;
alter table public.circle_comments  enable row level security;
alter table public.circle_invites   enable row level security;

drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or public.shares_a_journal_with(id)
    or public.shares_a_notebook_with(id)
    or public.shares_a_circle_with(id)
  );

create policy circles_select on public.circles for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_circle_member(id));
create policy circles_insert on public.circles for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy circles_update on public.circles for update to authenticated
  using (public.circle_role_of(id) = 'owner') with check (public.circle_role_of(id) = 'owner');
create policy circles_delete on public.circles for delete to authenticated
  using (public.circle_role_of(id) = 'owner');

create policy circle_members_select on public.circle_members for select to authenticated
  using (public.is_circle_member(circle_id));
create policy circle_members_delete on public.circle_members for delete to authenticated
  using (public.circle_role_of(circle_id) = 'owner' and user_id <> (select auth.uid()));

create policy circle_posts_select on public.circle_posts for select to authenticated
  using (public.is_circle_member(circle_id));
create policy circle_posts_insert on public.circle_posts for insert to authenticated
  with check (author_id = (select auth.uid()) and public.is_circle_member(circle_id));
create policy circle_posts_update on public.circle_posts for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()) and public.is_circle_member(circle_id));
create policy circle_posts_delete on public.circle_posts for delete to authenticated
  using (author_id = (select auth.uid()) or public.circle_role_of(circle_id) = 'owner');

create policy circle_reactions_select on public.circle_reactions for select to authenticated
  using (public.is_circle_member(circle_id));
create policy circle_reactions_insert on public.circle_reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_circle_member(circle_id));
create policy circle_reactions_delete on public.circle_reactions for delete to authenticated
  using (user_id = (select auth.uid()));

create policy circle_comments_select on public.circle_comments for select to authenticated
  using (public.is_circle_member(circle_id));
create policy circle_comments_insert on public.circle_comments for insert to authenticated
  with check (author_id = (select auth.uid()) and public.is_circle_member(circle_id));
create policy circle_comments_delete on public.circle_comments for delete to authenticated
  using (author_id = (select auth.uid()) or public.circle_role_of(circle_id) = 'owner');

create policy circle_invites_select on public.circle_invites for select to authenticated
  using (public.is_circle_member(circle_id));

grant select, insert, update, delete on public.circles to authenticated;
grant select, delete on public.circle_members to authenticated;
grant select, insert, update, delete on public.circle_posts to authenticated;
grant select, insert, delete on public.circle_reactions to authenticated;
grant select, insert, delete on public.circle_comments to authenticated;
grant select on public.circle_invites to authenticated;

grant execute on function public.circle_role_of(uuid) to authenticated;
grant execute on function public.is_circle_member(uuid) to authenticated;
grant execute on function public.shares_a_circle_with(uuid) to authenticated;
grant execute on function public.create_circle_invite(uuid) to authenticated;
grant execute on function public.leave_circle(uuid) to authenticated;
grant execute on function public.mark_circles_seen(uuid) to authenticated;
revoke execute on function public.circles_add_owner() from public, anon, authenticated;
revoke execute on function public.circles_freeze_owner() from public, anon, authenticated;
revoke execute on function public.circle_posts_freeze_keys() from public, anon, authenticated;
revoke execute on function public.circle_child_set_circle() from public, anon, authenticated;
revoke execute on function public.events_check_post() from public, anon, authenticated;

-- Temps réel : nouvelles publications et commentaires (RLS appliquée).
alter publication supabase_realtime add table public.circle_posts;
alter publication supabase_realtime add table public.circle_comments;
