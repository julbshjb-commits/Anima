-- Espace « M'organiser » : projets, tâches, agenda et rituels.
--
-- Tout est strictement personnel pour l'instant : chaque ligne appartient à
-- une personne (owner_id) et n'est visible que d'elle. Le partage de tâches
-- avec un cercle viendra avec l'espace Cercles, dans une migration à part.

-- ---------------------------------------------------------------------
-- Projets (« Partiels de décembre », « Déménagement »…)
-- ---------------------------------------------------------------------

create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 80),
  color       text not null default 'pensif' check (color in ('lumineux','serein','tendre','pensif','fatigue','tendu','melancolique')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz
);
create index projects_owner_idx on public.projects (owner_id) where archived_at is null;

-- ---------------------------------------------------------------------
-- Tâches
-- ---------------------------------------------------------------------

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  project_id   uuid references public.projects (id) on delete set null,
  title        text not null check (char_length(title) between 1 and 200),
  note         text check (char_length(note) <= 2000),
  due_date     date,
  due_time     time,
  duration_min integer check (duration_min between 1 and 1440),
  done_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (due_time is null or due_date is not null)
);
create index tasks_owner_due_idx on public.tasks (owner_id, due_date);
create index tasks_project_idx on public.tasks (project_id);

-- Une tâche ne peut être rangée que dans un de ses propres projets.
create function public.tasks_check_project()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.project_id is not null and not exists (
    select 1 from public.projects p where p.id = new.project_id and p.owner_id = new.owner_id
  ) then
    raise exception 'Projet introuvable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger tasks_check_project before insert or update of project_id, owner_id on public.tasks
  for each row execute function public.tasks_check_project();

-- ---------------------------------------------------------------------
-- Agenda (rendez-vous)
-- ---------------------------------------------------------------------

create table public.events (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 120),
  place      text check (char_length(place) <= 120),
  color      text not null default 'pensif' check (color in ('lumineux','serein','tendre','pensif','fatigue','tendu','melancolique')),
  starts_at  timestamptz not null,
  ends_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index events_owner_start_idx on public.events (owner_id, starts_at);

-- ---------------------------------------------------------------------
-- Rituels (« Lire 20 minutes ») et leurs jours cochés
-- ---------------------------------------------------------------------

create table public.rituals (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 80),
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);
create index rituals_owner_idx on public.rituals (owner_id) where archived_at is null;

create table public.ritual_checks (
  ritual_id uuid not null references public.rituals (id) on delete cascade,
  owner_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day       date not null,
  primary key (ritual_id, day)
);

create function public.ritual_checks_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.rituals r where r.id = new.ritual_id and r.owner_id = new.owner_id) then
    raise exception 'Rituel introuvable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger ritual_checks_owner before insert on public.ritual_checks
  for each row execute function public.ritual_checks_owner();

-- ---------------------------------------------------------------------
-- updated_at, RLS et droits
-- ---------------------------------------------------------------------

create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

alter table public.projects      enable row level security;
alter table public.tasks         enable row level security;
alter table public.events        enable row level security;
alter table public.rituals       enable row level security;
alter table public.ritual_checks enable row level security;

-- Chacun ne voit et ne modifie que ce qui lui appartient.
create policy projects_own on public.projects for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy tasks_own on public.tasks for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy events_own on public.events for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy rituals_own on public.rituals for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy ritual_checks_own on public.ritual_checks for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

grant select, insert, update, delete on public.projects, public.tasks, public.events, public.rituals to authenticated;
grant select, insert, delete on public.ritual_checks to authenticated;

-- Les fonctions de déclencheur ne sont jamais appelées directement.
revoke execute on function public.tasks_check_project() from public, anon, authenticated;
revoke execute on function public.ritual_checks_owner() from public, anon, authenticated;
