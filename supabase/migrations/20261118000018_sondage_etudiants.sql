-- Questionnaire étudiants (/sondage) : réponses anonymes, e-mail facultatif pour la liste d'attente.
-- Tout le monde peut répondre (même sans compte) ; seule l'équipe Anima peut lire.
create table public.sondage_reponses (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  filiere     text not null check (char_length(filiere) <= 40),
  methodes    text[] not null default '{}' check (cardinality(methodes) <= 10),
  debut       text not null check (char_length(debut) <= 40),
  oubli       text not null check (char_length(oubli) <= 40),
  usage_cartes text not null check (char_length(usage_cartes) <= 40),
  frein       text not null check (char_length(frein) <= 60),
  utilite     smallint not null check (utilite between 1 and 5),
  promo       smallint not null check (promo between 1 and 5),
  prix        text not null check (char_length(prix) <= 20),
  enerve      text not null default '' check (char_length(enerve) <= 1000),
  email       text check (email is null or (char_length(email) <= 200 and email like '%@%')),
  accord_email boolean not null default false,
  check (email is null or accord_email)
);

alter table public.sondage_reponses enable row level security;

create policy "sondage : tout le monde peut répondre" on public.sondage_reponses
  for insert to anon, authenticated with check (true);

create policy "sondage : seule l'équipe Anima lit" on public.sondage_reponses
  for select to authenticated using (public.is_app_admin());

grant insert on public.sondage_reponses to anon, authenticated;
grant select on public.sondage_reponses to authenticated;
