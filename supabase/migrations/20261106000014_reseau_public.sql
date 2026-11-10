-- =====================================================================
-- Anima — migration 14 : le réseau public (ouverture le 18 janvier 2027)
--
-- Principes :
--   * Le réseau est à part : un profil public (pseudo, nom, bio, photo)
--     distinct du profil privé. Rien de privé n'y entre sans un geste
--     explicite (« Publier »). Le journal intime n'est jamais publiable.
--   * Participer (publier, suivre, aimer, commenter) demande un profil
--     public, créé en confirmant avoir 15 ans ou plus.
--   * Un compte privé valide chaque abonné ; ses publications ne sont
--     visibles que de ses abonnés acceptés.
--   * Bloquer coupe tout dans les deux sens et retire les abonnements.
--   * 3 signalements de personnes différentes masquent une publication ou
--     un commentaire en attendant la modération.
--   * Les assistants IA (connecteur) n'ont aucun accès au réseau.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Profils publics
-- ---------------------------------------------------------------------

create table public.public_profiles (
  id               uuid primary key references public.profiles (id) on delete cascade,
  handle           text not null unique
                   check (handle ~ '^[a-z0-9_][a-z0-9_.]{1,22}[a-z0-9_]$' and handle !~ '\.\.'),
  name             text not null check (char_length(btrim(name)) between 1 and 40),
  bio              text not null default '' check (char_length(bio) <= 160),
  avatar_path      text check (avatar_path is null or char_length(avatar_path) <= 300),
  is_private       boolean not null default false,
  age_confirmed_at timestamptz not null default now(),
  suspended_at     timestamptz,
  followers_count  integer not null default 0,
  following_count  integer not null default 0,
  posts_count      integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Pseudos réservés (marque, rôles, pages du site).
create function public.is_reserved_handle(p text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p = any (array[
    'anima', 'admin', 'administrateur', 'moderation', 'moderateur', 'support', 'aide', 'help',
    'equipe', 'team', 'officiel', 'official', 'contact', 'reglages', 'compte', 'connexion',
    'decouvrir', 'fil', 'profil', 'publier', 'notifications', 'recherche', 'root', 'system'
  ]);
$$;

alter table public.public_profiles
  add constraint public_profiles_handle_not_reserved check (not public.is_reserved_handle(handle));

-- ---------------------------------------------------------------------
-- Modération : équipe Anima
-- ---------------------------------------------------------------------

create table public.app_admins (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_admins a where a.user_id = auth.uid());
$$;

-- Vrai dans une fonction de confiance (compteurs, masquage automatique)
-- ou pour l'équipe Anima : seuls ces cas peuvent toucher aux champs protégés.
create function public.is_trusted_write()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('anima.trusted', true), '') = 'on' or public.is_app_admin();
$$;

-- ---------------------------------------------------------------------
-- Blocages
-- ---------------------------------------------------------------------

create table public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

create function public.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks b
    where (b.blocker_id = p_a and b.blocked_id = p_b)
       or (b.blocker_id = p_b and b.blocked_id = p_a)
  );
$$;

-- ---------------------------------------------------------------------
-- Abonnements
-- ---------------------------------------------------------------------

create table public.follows (
  follower_id uuid not null default auth.uid() references public.public_profiles (id) on delete cascade,
  followee_id uuid not null references public.public_profiles (id) on delete cascade,
  status      text not null default 'accepted' check (status in ('accepted', 'pending')),
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index follows_followee_idx on public.follows (followee_id, status);

-- Peut-on voir le profil (en-tête) de cette personne ?
create function public.can_see_profile(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user = auth.uid()
      or exists (
        select 1 from public.public_profiles p
        where p.id = p_user and p.suspended_at is null
          and not public.is_blocked_between(auth.uid(), p_user)
      );
$$;

-- Peut-on voir ses publications ? (compte privé : abonnés acceptés seulement)
create function public.can_see_posts_of(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user = auth.uid()
      or exists (
        select 1 from public.public_profiles p
        where p.id = p_user and p.suspended_at is null
          and not public.is_blocked_between(auth.uid(), p_user)
          and (not p.is_private or exists (
            select 1 from public.follows f
            where f.follower_id = auth.uid() and f.followee_id = p_user and f.status = 'accepted'))
      );
$$;

-- ---------------------------------------------------------------------
-- Publications, j'aime, commentaires
-- ---------------------------------------------------------------------

create table public.posts (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid not null default auth.uid() references public.public_profiles (id) on delete cascade,
  body           text not null default '' check (char_length(body) <= 2000),
  mood           public.mood,
  photo_path     text check (photo_path is null or char_length(photo_path) <= 300),
  source         text not null default 'libre' check (source in ('libre', 'journal', 'note', 'citation')),
  quote_by       text check (quote_by is null or char_length(quote_by) <= 120),
  likes_count    integer not null default 0,
  comments_count integer not null default 0,
  hidden_at      timestamptz,
  created_at     timestamptz not null default now(),
  edited_at      timestamptz,
  check (char_length(btrim(body)) > 0 or photo_path is not null)
);

create index posts_created_idx on public.posts (created_at desc);
create index posts_author_idx on public.posts (author_id, created_at desc);

create table public.post_likes (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.public_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index post_likes_user_idx on public.post_likes (user_id);

create table public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  author_id  uuid not null default auth.uid() references public.public_profiles (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 500),
  hidden_at  timestamptz,
  created_at timestamptz not null default now()
);

create index post_comments_post_idx on public.post_comments (post_id, created_at);

-- ---------------------------------------------------------------------
-- Signalements et notifications
-- ---------------------------------------------------------------------

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target_kind text not null check (target_kind in ('post', 'comment', 'profile')),
  target_id   uuid not null,
  reason      text not null check (reason in ('spam', 'harcelement', 'haine', 'nudite', 'violence', 'mineur', 'autre')),
  details     text not null default '' check (char_length(details) <= 500),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolution  text check (resolution in ('retire', 'garde', 'suspendu')),
  unique (reporter_id, target_kind, target_id)
);

create index reports_open_idx on public.reports (created_at) where resolved_at is null;
create index reports_target_idx on public.reports (target_kind, target_id);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  actor_id   uuid not null references public.public_profiles (id) on delete cascade,
  kind       text not null check (kind in ('follow', 'follow_request', 'follow_accepted', 'like', 'comment')),
  post_id    uuid references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create unique index notifications_like_once on public.notifications (user_id, actor_id, post_id) where kind = 'like';
create unique index notifications_follow_once on public.notifications (user_id, actor_id, kind)
  where kind in ('follow', 'follow_request', 'follow_accepted');

-- ---------------------------------------------------------------------
-- Déclencheurs
-- ---------------------------------------------------------------------

-- Pseudo et nom nettoyés ; seuls les champs modifiables bougent.
create function public.public_profiles_before()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.handle := lower(btrim(new.handle));
  new.name := btrim(new.name);
  new.bio := btrim(new.bio);
  if tg_op = 'INSERT' then
    new.age_confirmed_at := now();
    new.created_at := now();
    new.followers_count := 0;
    new.following_count := 0;
    new.posts_count := 0;
    if not public.is_app_admin() then new.suspended_at := null; end if;
  else
    new.id := old.id;
    new.created_at := old.created_at;
    new.age_confirmed_at := old.age_confirmed_at;
    if not public.is_trusted_write() then
      new.suspended_at := old.suspended_at;
      new.followers_count := old.followers_count;
      new.following_count := old.following_count;
      new.posts_count := old.posts_count;
    end if;
    if (new.handle, new.name, new.bio, new.avatar_path, new.is_private)
       is distinct from (old.handle, old.name, old.bio, old.avatar_path, old.is_private) then
      new.updated_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger public_profiles_before
  before insert or update on public.public_profiles
  for each row execute function public.public_profiles_before();

-- Passer en compte public accepte les demandes en attente.
create function public.public_profiles_opened()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_private and not new.is_private then
    update public.follows set status = 'accepted' where followee_id = new.id and status = 'pending';
  end if;
  return null;
end;
$$;

create trigger public_profiles_opened
  after update of is_private on public.public_profiles
  for each row execute function public.public_profiles_opened();

-- Abonnement : demande si le compte est privé ; impossible si bloqué.
create function public.follows_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_private boolean;
begin
  if public.is_blocked_between(new.follower_id, new.followee_id) then
    raise exception 'Abonnement impossible.' using errcode = '42501';
  end if;
  select p.is_private into v_private from public.public_profiles p
  where p.id = new.followee_id and p.suspended_at is null;
  if not found then
    raise exception 'Profil introuvable.' using errcode = '42501';
  end if;
  new.status := case when v_private then 'pending' else 'accepted' end;
  new.created_at := now();
  if (select count(*) from public.follows f
      where f.follower_id = new.follower_id and f.created_at > now() - interval '1 day') >= 200 then
    raise exception 'Trop d''abonnements aujourd''hui.' using errcode = '54000';
  end if;
  return new;
end;
$$;

create trigger follows_before_insert
  before insert on public.follows
  for each row execute function public.follows_before_insert();

-- La seule modification permise : accepter une demande.
create function public.follows_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.follower_id <> old.follower_id or new.followee_id <> old.followee_id
     or not (old.status = 'pending' and new.status = 'accepted') then
    raise exception 'Modification interdite.' using errcode = '42501';
  end if;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger follows_before_update
  before update on public.follows
  for each row execute function public.follows_before_update();

-- Compteurs et notifications des abonnements.
create function public.follows_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('anima.trusted', 'on', true);
  if tg_op in ('UPDATE', 'DELETE') and old.status = 'accepted' then
    update public.public_profiles set followers_count = greatest(followers_count - 1, 0) where id = old.followee_id;
    update public.public_profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.status = 'accepted' then
    update public.public_profiles set followers_count = followers_count + 1 where id = new.followee_id;
    update public.public_profiles set following_count = following_count + 1 where id = new.follower_id;
  end if;

  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, actor_id, kind)
    values (new.followee_id, new.follower_id, case when new.status = 'pending' then 'follow_request' else 'follow' end)
    on conflict do nothing;
  elsif tg_op = 'UPDATE' then
    delete from public.notifications
    where user_id = new.followee_id and actor_id = new.follower_id and kind = 'follow_request';
    insert into public.notifications (user_id, actor_id, kind)
    values (new.follower_id, new.followee_id, 'follow_accepted')
    on conflict do nothing;
  else
    delete from public.notifications
    where user_id = old.followee_id and actor_id = old.follower_id and kind in ('follow', 'follow_request');
  end if;
  perform set_config('anima.trusted', 'off', true);
  return null;
end;
$$;

create trigger follows_after
  after insert or update or delete on public.follows
  for each row execute function public.follows_after();

-- Bloquer retire les abonnements dans les deux sens.
create function public.blocks_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and followee_id = new.blocked_id)
     or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  delete from public.notifications
  where (user_id = new.blocker_id and actor_id = new.blocked_id);
  return null;
end;
$$;

create trigger blocks_after_insert
  after insert on public.blocks
  for each row execute function public.blocks_after_insert();

-- Publications : champs figés, limite de 30 par jour.
create function public.posts_before()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from public.public_profiles p where p.id = new.author_id and p.suspended_at is not null) then
      raise exception 'Compte suspendu.' using errcode = '42501';
    end if;
    new.created_at := now();
    new.edited_at := null;
    new.likes_count := 0;
    new.comments_count := 0;
    new.hidden_at := null;
    if (select count(*) from public.posts p
        where p.author_id = new.author_id and p.created_at > now() - interval '1 day') >= 30 then
      raise exception 'Trop de publications aujourd''hui.' using errcode = '54000';
    end if;
  else
    new.id := old.id;
    new.author_id := old.author_id;
    new.created_at := old.created_at;
    new.photo_path := old.photo_path;
    new.source := old.source;
    if not public.is_trusted_write() then
      new.hidden_at := old.hidden_at;
      new.likes_count := old.likes_count;
      new.comments_count := old.comments_count;
    end if;
    if (new.body, new.mood, new.quote_by) is distinct from (old.body, old.mood, old.quote_by) then
      new.edited_at := now();
    else
      new.edited_at := old.edited_at;
    end if;
  end if;
  return new;
end;
$$;

create trigger posts_before
  before insert or update on public.posts
  for each row execute function public.posts_before();

create function public.posts_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('anima.trusted', 'on', true);
  if tg_op = 'INSERT' then
    update public.public_profiles set posts_count = posts_count + 1 where id = new.author_id;
  else
    update public.public_profiles set posts_count = greatest(posts_count - 1, 0) where id = old.author_id;
  end if;
  perform set_config('anima.trusted', 'off', true);
  return null;
end;
$$;

create trigger posts_after
  after insert or delete on public.posts
  for each row execute function public.posts_after();

-- J'aime : compteur et notification.
create function public.post_likes_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid;
begin
  perform set_config('anima.trusted', 'on', true);
  if tg_op = 'INSERT' then
    update public.posts set likes_count = likes_count + 1 where id = new.post_id returning author_id into v_author;
    if v_author is not null and v_author <> new.user_id then
      insert into public.notifications (user_id, actor_id, kind, post_id)
      values (v_author, new.user_id, 'like', new.post_id)
      on conflict do nothing;
    end if;
  else
    update public.posts set likes_count = greatest(likes_count - 1, 0) where id = old.post_id;
  end if;
  perform set_config('anima.trusted', 'off', true);
  return null;
end;
$$;

create trigger post_likes_after
  after insert or delete on public.post_likes
  for each row execute function public.post_likes_after();

-- Commentaires : champs figés, limite de 200 par jour, compteur, notification.
create function public.post_comments_before()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from public.public_profiles p where p.id = new.author_id and p.suspended_at is not null) then
      raise exception 'Compte suspendu.' using errcode = '42501';
    end if;
    new.created_at := now();
    new.body := btrim(new.body);
    new.hidden_at := null;
    if (select count(*) from public.post_comments c
        where c.author_id = new.author_id and c.created_at > now() - interval '1 day') >= 200 then
      raise exception 'Trop de commentaires aujourd''hui.' using errcode = '54000';
    end if;
    return new;
  end if;
  -- Seul le masquage (modération) peut changer un commentaire.
  if not public.is_trusted_write() then
    raise exception 'Un commentaire ne se modifie pas.' using errcode = '42501';
  end if;
  new.id := old.id;
  new.post_id := old.post_id;
  new.author_id := old.author_id;
  new.body := old.body;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger post_comments_before
  before insert or update on public.post_comments
  for each row execute function public.post_comments_before();

create function public.post_comments_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid;
begin
  perform set_config('anima.trusted', 'on', true);
  if tg_op = 'INSERT' then
    update public.posts set comments_count = comments_count + 1 where id = new.post_id returning author_id into v_author;
    if v_author is not null and v_author <> new.author_id then
      insert into public.notifications (user_id, actor_id, kind, post_id)
      values (v_author, new.author_id, 'comment', new.post_id);
    end if;
  else
    update public.posts set comments_count = greatest(comments_count - 1, 0) where id = old.post_id;
  end if;
  perform set_config('anima.trusted', 'off', true);
  return null;
end;
$$;

create trigger post_comments_after
  after insert or delete on public.post_comments
  for each row execute function public.post_comments_after();

-- Signalement : 3 personnes différentes masquent le contenu en attendant.
create function public.reports_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.target_kind in ('post', 'comment') and (
    select count(distinct r.reporter_id) from public.reports r
    where r.target_kind = new.target_kind and r.target_id = new.target_id and r.resolved_at is null
  ) >= 3 then
    perform set_config('anima.trusted', 'on', true);
    if new.target_kind = 'post' then
      update public.posts set hidden_at = coalesce(hidden_at, now()) where id = new.target_id;
    else
      update public.post_comments set hidden_at = coalesce(hidden_at, now()) where id = new.target_id;
    end if;
    perform set_config('anima.trusted', 'off', true);
  end if;
  return null;
end;
$$;

create function public.reports_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.reporter_id := auth.uid();
  new.created_at := now();
  new.resolved_at := null;
  new.resolution := null;
  if (select count(*) from public.reports r
      where r.reporter_id = new.reporter_id and r.created_at > now() - interval '1 day') >= 30 then
    raise exception 'Trop de signalements aujourd''hui.' using errcode = '54000';
  end if;
  return new;
end;
$$;

create trigger reports_before_insert
  before insert on public.reports
  for each row execute function public.reports_before_insert();

create trigger reports_after_insert
  after insert on public.reports
  for each row execute function public.reports_after_insert();

-- ---------------------------------------------------------------------
-- Fonctions appelées par l'appli
-- ---------------------------------------------------------------------

-- Le pseudo est-il libre ?
create function public.handle_available(p_handle text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select lower(btrim(p_handle)) ~ '^[a-z0-9_][a-z0-9_.]{1,22}[a-z0-9_]$'
     and lower(btrim(p_handle)) !~ '\.\.'
     and not public.is_reserved_handle(lower(btrim(p_handle)))
     and not exists (
       select 1 from public.public_profiles p
       where p.handle = lower(btrim(p_handle)) and p.id <> auth.uid()
     );
$$;

-- Modération par l'équipe Anima.
create function public.moderate(p_kind text, p_target uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Réservé à l''équipe Anima.' using errcode = '42501';
  end if;
  if p_action not in ('retire', 'garde', 'suspendu') then
    raise exception 'Action inconnue.' using errcode = '22023';
  end if;

  if p_kind = 'post' then
    update public.posts set hidden_at = case when p_action = 'garde' then null else coalesce(hidden_at, now()) end
    where id = p_target;
    if p_action = 'suspendu' then
      update public.public_profiles set suspended_at = now()
      where id = (select author_id from public.posts where id = p_target);
    end if;
  elsif p_kind = 'comment' then
    update public.post_comments set hidden_at = case when p_action = 'garde' then null else coalesce(hidden_at, now()) end
    where id = p_target;
    if p_action = 'suspendu' then
      update public.public_profiles set suspended_at = now()
      where id = (select author_id from public.post_comments where id = p_target);
    end if;
  elsif p_kind = 'profile' then
    update public.public_profiles set suspended_at = case when p_action = 'garde' then null else now() end
    where id = p_target;
  else
    raise exception 'Type inconnu.' using errcode = '22023';
  end if;

  update public.reports set resolved_at = now(), resolution = p_action
  where target_kind = p_kind and target_id = p_target and resolved_at is null;
end;
$$;

-- Marque toutes les notifications comme lues.
create function public.mark_notifications_read()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
$$;

-- ---------------------------------------------------------------------
-- Règles d'accès
-- ---------------------------------------------------------------------

alter table public.public_profiles enable row level security;
alter table public.app_admins      enable row level security;
alter table public.blocks          enable row level security;
alter table public.follows         enable row level security;
alter table public.posts           enable row level security;
alter table public.post_likes      enable row level security;
alter table public.post_comments   enable row level security;
alter table public.reports         enable row level security;
alter table public.notifications   enable row level security;

-- Celui qui bloque garde l'en-tête de la personne bloquée (pour pouvoir la débloquer).
create policy public_profiles_select on public.public_profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_app_admin()
         or (suspended_at is null and not public.is_blocked_between((select auth.uid()), id))
         or exists (select 1 from public.blocks b where b.blocker_id = (select auth.uid()) and b.blocked_id = id));
create policy public_profiles_insert on public.public_profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy public_profiles_update on public.public_profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy public_profiles_delete on public.public_profiles for delete to authenticated
  using (id = (select auth.uid()));

create policy app_admins_select on public.app_admins for select to authenticated
  using (user_id = (select auth.uid()));

create policy blocks_select on public.blocks for select to authenticated
  using (blocker_id = (select auth.uid()));
create policy blocks_insert on public.blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()));
create policy blocks_delete on public.blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

-- Abonnements : les siens, et ceux des profils dont on voit les publications.
create policy follows_select on public.follows for select to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid())
         or (status = 'accepted' and public.can_see_posts_of(followee_id) and public.can_see_profile(follower_id)));
create policy follows_insert on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid()));
create policy follows_update on public.follows for update to authenticated
  using (followee_id = (select auth.uid())) with check (followee_id = (select auth.uid()));
create policy follows_delete on public.follows for delete to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));

create policy posts_select on public.posts for select to authenticated
  using (author_id = (select auth.uid()) or public.is_app_admin()
         or (hidden_at is null and public.can_see_posts_of(author_id)));
create policy posts_insert on public.posts for insert to authenticated
  with check (author_id = (select auth.uid()));
create policy posts_update on public.posts for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy posts_delete on public.posts for delete to authenticated
  using (author_id = (select auth.uid()));

create policy post_likes_select on public.post_likes for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id) and public.can_see_profile(user_id));
create policy post_likes_insert on public.post_likes for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.posts p where p.id = post_id and p.hidden_at is null));
create policy post_likes_delete on public.post_likes for delete to authenticated
  using (user_id = (select auth.uid()));

create policy post_comments_select on public.post_comments for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id)
         and (author_id = (select auth.uid()) or public.is_app_admin()
              or (hidden_at is null and public.can_see_profile(author_id))));
create policy post_comments_insert on public.post_comments for insert to authenticated
  with check (author_id = (select auth.uid())
              and exists (select 1 from public.posts p where p.id = post_id and p.hidden_at is null)
              and not public.is_blocked_between((select auth.uid()), (select p.author_id from public.posts p where p.id = post_id)));
-- L'auteur du commentaire, ou celui de la publication, peut le retirer.
create policy post_comments_delete on public.post_comments for delete to authenticated
  using (author_id = (select auth.uid())
         or exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())));

create policy reports_select on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or public.is_app_admin());
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));

create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) and public.can_see_profile(actor_id));
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

-- Aucun accès au réseau pour les assistants IA reliés.
do $$
declare
  t text;
begin
  foreach t in array array['public_profiles', 'app_admins', 'blocks', 'follows', 'posts',
                           'post_likes', 'post_comments', 'reports', 'notifications'] loop
    execute format(
      'create policy ai_gate on public.%I as restrictive for all to authenticated using ((auth.jwt() ->> ''client_id'') is null) with check ((auth.jwt() ->> ''client_id'') is null)',
      t);
  end loop;
end $$;

-- Droits : rien par défaut, puis le strict nécessaire.
revoke all on public.public_profiles, public.app_admins, public.blocks, public.follows, public.posts,
              public.post_likes, public.post_comments, public.reports, public.notifications
  from anon, authenticated;

grant select, insert, delete on public.public_profiles to authenticated;
grant update (handle, name, bio, avatar_path, is_private) on public.public_profiles to authenticated;
grant select on public.app_admins to authenticated;
grant select, insert, delete on public.blocks to authenticated;
grant select, insert, delete on public.follows to authenticated;
grant update (status) on public.follows to authenticated;
grant select, insert, delete on public.posts to authenticated;
grant update (body, mood, quote_by) on public.posts to authenticated;
grant select, insert, delete on public.post_likes to authenticated;
grant select, insert, delete on public.post_comments to authenticated;
grant select, insert on public.reports to authenticated;
grant select, delete on public.notifications to authenticated;

-- ---------------------------------------------------------------------
-- Stockage : bucket privé « social », chemin {user_id}/{nom}
-- Photo de profil : {user_id}/avatar-… (visible de tous ceux qui voient le profil)
-- Photo de publication : {user_id}/post-… (visible de ceux qui voient ses publications)
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('social', 'social', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create function public.social_can_read(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  v_owner := (storage.foldername(p_name))[1]::uuid;
  if storage.filename(p_name) like 'avatar-%' then
    return public.can_see_profile(v_owner);
  end if;
  return public.can_see_posts_of(v_owner);
exception when others then
  return false;
end;
$$;

create policy social_read on storage.objects for select to authenticated
  using (bucket_id = 'social' and public.social_can_read(name));
create policy social_write on storage.objects for insert to authenticated
  with check (bucket_id = 'social'
              and owner_id = (auth.uid())::text
              and (storage.foldername(name))[1] = (auth.uid())::text
              and exists (select 1 from public.public_profiles p where p.id = auth.uid() and p.suspended_at is null));
create policy social_remove on storage.objects for delete to authenticated
  using (bucket_id = 'social' and owner_id = (auth.uid())::text);

-- Le connecteur IA ne voit pas le bucket « social ».
alter policy ai_gate on storage.objects
  using (case bucket_id
           when 'attachments' then public.ai_allows_journal(public.storage_journal_id(name))
           when 'fichiers' then public.ai_allows('fichiers')
           when 'social' then (auth.jwt() ->> 'client_id') is null
           else true end)
  with check (case bucket_id
           when 'attachments' then public.ai_allows_journal(public.storage_journal_id(name))
           when 'fichiers' then public.ai_allows('fichiers')
           when 'social' then (auth.jwt() ->> 'client_id') is null
           else true end);

-- ---------------------------------------------------------------------
-- Droits d'exécution des fonctions
-- ---------------------------------------------------------------------

revoke execute on function
  public.is_reserved_handle(text), public.is_app_admin(), public.is_blocked_between(uuid, uuid),
  public.can_see_profile(uuid), public.can_see_posts_of(uuid), public.handle_available(text),
  public.moderate(text, uuid, text), public.mark_notifications_read(), public.social_can_read(text),
  public.is_trusted_write(), public.public_profiles_before(), public.public_profiles_opened(), public.follows_before_insert(),
  public.follows_before_update(), public.follows_after(), public.blocks_after_insert(),
  public.posts_before(), public.posts_after(), public.post_likes_after(), public.post_comments_before(),
  public.post_comments_after(), public.reports_before_insert(), public.reports_after_insert()
  from public, anon, authenticated;

grant execute on function
  public.is_reserved_handle(text), public.is_app_admin(), public.is_blocked_between(uuid, uuid),
  public.can_see_profile(uuid), public.can_see_posts_of(uuid), public.handle_available(text),
  public.moderate(text, uuid, text), public.mark_notifications_read(), public.social_can_read(text),
  public.is_trusted_write()
  to authenticated;
