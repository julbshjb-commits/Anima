-- Espace « Bibliothèque » : livres, films, séries, podcasts et articles,
-- citations gardées et objectif de lecture.
--
-- Tout est personnel : chaque ligne appartient à une personne (owner_id) et
-- n'est visible que d'elle. Partager une œuvre ou une citation passe par une
-- publication dans un cercle, qui en fait une copie (rien n'est exposé).

create table public.works (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind           text not null default 'livre' check (kind in ('livre', 'film', 'serie', 'podcast', 'article')),
  title          text not null check (char_length(title) between 1 and 200),
  creator        text check (char_length(creator) <= 120),          -- autrice, réalisateur, émission
  cover          text not null default 'vintage-bordeaux' check (char_length(cover) <= 40),
  status         text not null default 'a-lire' check (status in ('a-lire', 'en-cours', 'termine')),
  progress       integer check (progress >= 0),                      -- page, épisode, minute
  progress_total integer check (progress_total > 0),
  rating         smallint check (rating between 1 and 5),
  started_on     date,
  finished_on    date,
  url            text check (char_length(url) <= 2000 and url ~ '^https?://'),
  note           text check (char_length(note) <= 5000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (progress is null or progress_total is null or progress <= progress_total),
  check (finished_on is null or started_on is null or finished_on >= started_on)
);
create index works_owner_idx on public.works (owner_id, status, updated_at desc);

create table public.quotes (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  work_id    uuid references public.works (id) on delete set null,
  text       text not null check (char_length(text) between 1 and 2000),
  source     text check (char_length(source) <= 200),               -- « p. 254 », « Montaigne, Essais »
  created_at timestamptz not null default now()
);
create index quotes_owner_idx on public.quotes (owner_id, created_at desc);

-- Une citation ne peut être rattachée qu'à une de ses propres œuvres.
create function public.quotes_check_work()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.work_id is not null and not exists (
    select 1 from public.works w where w.id = new.work_id and w.owner_id = new.owner_id
  ) then
    raise exception 'Œuvre introuvable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger quotes_check_work before insert or update of work_id, owner_id on public.quotes
  for each row execute function public.quotes_check_work();

create table public.reading_goals (
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  year     smallint not null check (year between 2000 and 2100),
  target   smallint not null check (target between 1 and 1000),
  primary key (owner_id, year)
);

create trigger works_touch before update on public.works
  for each row execute function public.touch_updated_at();

alter table public.works         enable row level security;
alter table public.quotes        enable row level security;
alter table public.reading_goals enable row level security;

create policy works_own on public.works for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy quotes_own on public.quotes for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy reading_goals_own on public.reading_goals for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

grant select, insert, update, delete on public.works, public.quotes, public.reading_goals to authenticated;
revoke execute on function public.quotes_check_work() from public, anon, authenticated;
