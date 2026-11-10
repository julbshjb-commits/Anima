-- Espace « Flashcards » : paquets de fiches, révision espacée et progrès.
--
-- Tout est strictement personnel : chaque ligne appartient à une personne
-- (owner_id) et n'est visible que d'elle. Un paquet peut être relié à un carnet
-- de Notes ou à un projet d'Organiser, une carte à la note dont elle vient,
-- mais seulement si la personne y a déjà accès.
--
-- Modèle (inspiré d'Anki) :
--   decks            un paquet, rangé dans une matière (qui sert de dossier)
--   cards            le contenu : question/réponse, inversée ou texte à trous
--   card_schedules   ce qu'on révise vraiment : une ligne par sens (inversée = 2)
--                    ou par trou ({{c1::…}}, {{c2::…}}), avec sa prochaine date
--   card_reviews     l'historique des réponses (statistiques, séries)
--   flashcard_settings  limites du jour et objectif quotidien
--
-- L'algorithme de répétition espacée vit dans @anima/core (flashcards.ts),
-- partagé par le web et le mobile.

create table public.decks (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 120),
  subject     text check (char_length(subject) <= 80),               -- matière : « Histoire », « Anglais »
  description text check (char_length(description) <= 500),
  cover       text not null default 'lumiere-miel' check (char_length(cover) <= 40),
  notebook_id uuid references public.notebooks (id) on delete set null,
  project_id  uuid references public.projects (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index decks_owner_idx on public.decks (owner_id, subject, updated_at desc);

create table public.cards (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  deck_id    uuid not null references public.decks (id) on delete cascade,
  kind       text not null default 'basique' check (kind in ('basique', 'inversee', 'trous')),
  front      text not null check (char_length(front) between 1 and 2000),
  back       text not null default '' check (char_length(back) <= 4000),
  tags       text[] not null default '{}' check (cardinality(tags) <= 20),
  note_id    uuid references public.notes (id) on delete set null,
  source     text not null default 'manuel' check (source in ('manuel', 'ia', 'auto')),
  status     text not null default 'active' check (status in ('active', 'a-verifier')),
  suspended  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'basique' or char_length(back) >= 1),
  check (kind <> 'inversee' or char_length(back) >= 1),
  check (kind <> 'trous' or front ~ '\{\{c[0-9]+::')
);
create index cards_deck_idx on public.cards (deck_id, created_at);
create index cards_owner_idx on public.cards (owner_id, status);

create table public.card_schedules (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  card_id          uuid not null references public.cards (id) on delete cascade,
  variant          smallint not null default 0 check (variant between 0 and 99),
  state            text not null default 'nouvelle' check (state in ('nouvelle', 'apprentissage', 'revision', 'reapprentissage')),
  step             smallint not null default 0 check (step >= 0),
  due_at           timestamptz not null default now(),
  interval_days    real not null default 0 check (interval_days >= 0),
  ease             real not null default 2.5 check (ease between 1.3 and 5),
  reps             integer not null default 0 check (reps >= 0),
  lapses           integer not null default 0 check (lapses >= 0),
  last_reviewed_at timestamptz,
  unique (card_id, variant)
);
create index card_schedules_due_idx on public.card_schedules (owner_id, due_at);

create table public.card_reviews (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  schedule_id     uuid references public.card_schedules (id) on delete set null,
  deck_id         uuid references public.decks (id) on delete set null,
  rating          smallint not null check (rating between 1 and 4),   -- 1 à revoir, 2 difficile, 3 bien, 4 facile
  state_before    text not null check (state_before in ('nouvelle', 'apprentissage', 'revision', 'reapprentissage')),
  interval_before real not null default 0,
  interval_after  real not null default 0,
  duration_ms     integer check (duration_ms between 0 and 3600000),
  reviewed_at     timestamptz not null default now()
);
create index card_reviews_owner_idx on public.card_reviews (owner_id, reviewed_at desc);

create table public.flashcard_settings (
  owner_id        uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  new_per_day     smallint not null default 20 check (new_per_day between 0 and 999),
  reviews_per_day smallint not null default 200 check (reviews_per_day between 1 and 9999),
  daily_goal      smallint not null default 30 check (daily_goal between 1 and 9999),
  updated_at      timestamptz not null default now()
);

create trigger decks_touch before update on public.decks
  for each row execute function public.touch_updated_at();
create trigger cards_touch before update on public.cards
  for each row execute function public.touch_updated_at();

-- Liens : seulement vers ce que la personne voit déjà (la RLS s'applique ici,
-- les fonctions tournent avec les droits de l'appelant).
create function public.decks_check_links()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.notebook_id is not null and not exists (select 1 from public.notebooks n where n.id = new.notebook_id) then
    raise exception 'Carnet introuvable' using errcode = '42501';
  end if;
  if new.project_id is not null and not exists (
    select 1 from public.projects p where p.id = new.project_id and p.owner_id = new.owner_id
  ) then
    raise exception 'Projet introuvable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger decks_check_links before insert or update of notebook_id, project_id, owner_id on public.decks
  for each row execute function public.decks_check_links();

create function public.cards_check_links()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.decks d where d.id = new.deck_id and d.owner_id = new.owner_id) then
    raise exception 'Paquet introuvable' using errcode = '42501';
  end if;
  if new.note_id is not null and not exists (select 1 from public.notes n where n.id = new.note_id) then
    raise exception 'Note introuvable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger cards_check_links before insert or update of deck_id, note_id, owner_id on public.cards
  for each row execute function public.cards_check_links();

-- Une ligne de révision par sens ou par trou, tenue à jour quand la carte change.
-- Les progrès d'un sens qui existe toujours sont gardés.
create function public.cards_sync_schedules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v smallint[];
begin
  if new.kind = 'inversee' then
    v := array[0, 1];
  elsif new.kind = 'trous' then
    select coalesce(array_agg(distinct m[1]::smallint), array[1::smallint]) into v
      from regexp_matches(new.front, '\{\{c([0-9]{1,2})::', 'g') as m;
  else
    v := array[0];
  end if;
  delete from public.card_schedules s where s.card_id = new.id and s.variant <> all (v);
  insert into public.card_schedules (owner_id, card_id, variant)
    select new.owner_id, new.id, x from unnest(v) as x
    on conflict (card_id, variant) do nothing;
  return null;
end;
$$;
create trigger cards_sync_schedules after insert or update of kind, front on public.cards
  for each row execute function public.cards_sync_schedules();

-- Une ligne de révision ne peut pointer que vers une de ses propres cartes.
create function public.card_schedules_check_card()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.cards c where c.id = new.card_id and c.owner_id = new.owner_id) then
    raise exception 'Carte introuvable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger card_schedules_check_card before insert or update of card_id, owner_id on public.card_schedules
  for each row execute function public.card_schedules_check_card();

create function public.card_reviews_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.schedule_id is not null and not exists (
    select 1 from public.card_schedules s where s.id = new.schedule_id and s.owner_id = new.owner_id
  ) then
    raise exception 'Carte introuvable' using errcode = '42501';
  end if;
  if new.deck_id is not null and not exists (
    select 1 from public.decks d where d.id = new.deck_id and d.owner_id = new.owner_id
  ) then
    raise exception 'Paquet introuvable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger card_reviews_check before insert or update on public.card_reviews
  for each row execute function public.card_reviews_check();

alter table public.decks              enable row level security;
alter table public.cards              enable row level security;
alter table public.card_schedules     enable row level security;
alter table public.card_reviews       enable row level security;
alter table public.flashcard_settings enable row level security;

create policy decks_own on public.decks for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy cards_own on public.cards for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy card_schedules_own on public.card_schedules for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy card_reviews_own on public.card_reviews for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy flashcard_settings_own on public.flashcard_settings for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

grant select, insert, update, delete on
  public.decks, public.cards, public.card_schedules, public.card_reviews, public.flashcard_settings
  to authenticated;
revoke execute on function
  public.decks_check_links(), public.cards_check_links(), public.cards_sync_schedules(),
  public.card_schedules_check_card(), public.card_reviews_check()
  from public, anon, authenticated;

-- Connecteur IA : un espace « flashcards » à cocher, fermé par défaut.
alter table public.ai_access drop constraint if exists ai_access_spaces_check;
alter table public.ai_access add constraint ai_access_spaces_check
  check (spaces <@ array['journaux', 'intime', 'notes', 'organiser', 'cercles', 'bibliotheque', 'fichiers', 'flashcards']::text[]);

do $$
declare
  t text;
begin
  foreach t in array array['decks', 'cards', 'card_schedules', 'card_reviews', 'flashcard_settings'] loop
    execute format(
      'create policy ai_gate on public.%I as restrictive for all to authenticated using (public.ai_allows(%L)) with check (public.ai_allows(%L))',
      t, 'flashcards', 'flashcards');
  end loop;
end $$;


-- ---------------------------------------------------------------------------
-- Partage de paquets (promo, amis) et date d'examen.
--
-- Un paquet reste personnel. Son auteur peut lui donner un code de partage :
-- avec ce code, un camarade voit un aperçu, puis ajoute SA copie du paquet.
-- Chacun garde ses propres progrès ; la copie se met à jour d'un geste avec
-- les cartes que l'auteur a ajoutées depuis (jamais l'inverse).

alter table public.decks
  add column share_code     text unique check (share_code ~ '^[A-Z2-9]{8}$'),
  add column source_deck_id uuid references public.decks (id) on delete set null,
  add column exam_date      date;
alter table public.cards
  add column origin_card_id uuid references public.cards (id) on delete set null;
create index cards_origin_idx on public.cards (deck_id, origin_card_id);

-- Le code de partage et le lien vers la source ne s'écrivent que par les
-- fonctions ci-dessous : personne ne peut se rattacher au paquet d'autrui à la main.
create function public.decks_guard_sharing()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' and (new.share_code is not null or new.source_deck_id is not null) then
      raise exception 'immutable_columns' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and (new.share_code is distinct from old.share_code
                             or new.source_deck_id is distinct from old.source_deck_id) then
      raise exception 'immutable_columns' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger decks_guard_sharing before insert or update of share_code, source_deck_id on public.decks
  for each row execute function public.decks_guard_sharing();

create function public.cards_guard_origin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') and new.origin_card_id is distinct from
     (case when tg_op = 'UPDATE' then old.origin_card_id end) then
    raise exception 'immutable_columns' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger cards_guard_origin before insert or update of origin_card_id on public.cards
  for each row execute function public.cards_guard_origin();

-- Donne (ou retire) un code de partage. Réservé à l'auteur du paquet.
create function public.deck_share(p_deck_id uuid, p_on boolean)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not exists (select 1 from public.decks d where d.id = p_deck_id and d.owner_id = auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not p_on then
    update public.decks set share_code = null where id = p_deck_id;
    return null;
  end if;
  select share_code into v_code from public.decks where id = p_deck_id;
  while v_code is null loop
    begin
      update public.decks
        set share_code = public.generate_invite_code() || substr(public.generate_invite_code(), 1, 2)
        where id = p_deck_id
        returning share_code into v_code;
    exception when unique_violation then
      v_code := null;
    end;
  end loop;
  return v_code;
end;
$$;

-- Aperçu d'un paquet partagé (titre, matière, auteur, nombre de cartes, 3 exemples).
create function public.deck_preview(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'title', d.title,
    'subject', d.subject,
    'description', d.description,
    'cover', d.cover,
    'author', coalesce(p.display_name, 'Quelqu''un'),
    'cards', (select count(*) from public.cards c where c.deck_id = d.id and c.status = 'active'),
    'sample', (
      select coalesce(jsonb_agg(jsonb_build_object('kind', s.kind, 'front', s.front, 'back', s.back)), '[]'::jsonb)
      from (select c.kind, c.front, c.back from public.cards c
            where c.deck_id = d.id and c.status = 'active' order by c.created_at limit 3) s
    ),
    'mine', d.owner_id = auth.uid(),
    'copied', exists (select 1 from public.decks m where m.owner_id = auth.uid() and m.source_deck_id = d.id)
  )
  from public.decks d
  left join public.profiles p on p.id = d.owner_id
  where d.share_code = upper(trim(p_code)) and auth.uid() is not null;
$$;

-- Ajoute sa copie d'un paquet partagé, ou met à jour une copie existante
-- avec les nouvelles cartes de l'auteur. Renvoie l'id du paquet de la personne.
create function public.deck_import(p_code text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_src public.decks%rowtype;
  v_mine uuid;
begin
  if v_me is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_src from public.decks where share_code = upper(trim(p_code));
  if v_src.id is null then
    return null;
  end if;
  if v_src.owner_id = v_me then
    return v_src.id;
  end if;
  select id into v_mine from public.decks where owner_id = v_me and source_deck_id = v_src.id limit 1;
  if v_mine is null then
    insert into public.decks (owner_id, title, subject, description, cover, source_deck_id, exam_date)
      values (v_me, v_src.title, v_src.subject, v_src.description, v_src.cover, v_src.id, v_src.exam_date)
      returning id into v_mine;
  end if;
  insert into public.cards (owner_id, deck_id, kind, front, back, tags, source, origin_card_id)
    select v_me, v_mine, c.kind, c.front, c.back, c.tags, 'manuel', c.id
    from public.cards c
    where c.deck_id = v_src.id and c.status = 'active'
      and not exists (select 1 from public.cards m where m.deck_id = v_mine and m.origin_card_id = c.id)
    order by c.created_at;
  return v_mine;
end;
$$;

-- Nombre de nouvelles cartes de l'auteur pas encore dans la copie.
create function public.deck_updates(p_deck_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.decks mine
  join public.decks src on src.id = mine.source_deck_id and src.share_code is not null
  join public.cards c on c.deck_id = src.id and c.status = 'active'
  where mine.id = p_deck_id and mine.owner_id = auth.uid()
    and not exists (select 1 from public.cards m where m.deck_id = mine.id and m.origin_card_id = c.id);
$$;

-- Le code de la source sert à la mise à jour, sans jamais l'afficher.
create function public.deck_pull(p_deck_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_before integer;
  v_after integer;
begin
  select src.share_code into v_code
  from public.decks mine join public.decks src on src.id = mine.source_deck_id
  where mine.id = p_deck_id and mine.owner_id = auth.uid();
  if v_code is null then
    return 0;
  end if;
  select count(*) into v_before from public.cards where deck_id = p_deck_id;
  perform public.deck_import(v_code);
  select count(*) into v_after from public.cards where deck_id = p_deck_id;
  return v_after - v_before;
end;
$$;

revoke execute on function public.deck_share(uuid, boolean), public.deck_preview(text),
  public.deck_import(text), public.deck_updates(uuid), public.deck_pull(uuid) from public, anon;
grant execute on function public.deck_share(uuid, boolean), public.deck_preview(text),
  public.deck_import(text), public.deck_updates(uuid), public.deck_pull(uuid) to authenticated;
