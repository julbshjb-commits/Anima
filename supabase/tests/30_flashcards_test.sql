-- Tests de l'espace Flashcards : tout est privé, les sens et les trous
-- deviennent des lignes de révision, les liens restent dans ce qu'on voit.
\set ON_ERROR_STOP on

create or replace function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p::text, false);
  execute 'set role authenticated';
end $$;

create or replace function pg_temp.check(cond boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'ÉCHEC : %', label; end if;
  raise notice 'ok  %', label;
end $$;

reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('f1a5f1a5-0000-0000-0000-000000000001', 'chloe@example.org', '{"display_name":"Chloé"}'),
  ('f1a5f1a5-0000-0000-0000-000000000002', 'yanis@example.org', '{"display_name":"Yanis"}');

select pg_temp.as_user('f1a5f1a5-0000-0000-0000-000000000001');
insert into decks (id, title, subject) values ('dec0dec0-0000-0000-0000-000000000001', 'Révolution française', 'Histoire');
insert into cards (id, deck_id, kind, front, back) values
  ('ca0dca0d-0000-0000-0000-000000000001', 'dec0dec0-0000-0000-0000-000000000001', 'basique', 'Prise de la Bastille ?', '14 juillet 1789'),
  ('ca0dca0d-0000-0000-0000-000000000002', 'dec0dec0-0000-0000-0000-000000000001', 'inversee', 'Liberté', 'Freedom'),
  ('ca0dca0d-0000-0000-0000-000000000003', 'dec0dec0-0000-0000-0000-000000000001', 'trous', 'La {{c1::Déclaration}} des droits date de {{c2::1789}}.', '');
select pg_temp.check((select count(*) from card_schedules where card_id = 'ca0dca0d-0000-0000-0000-000000000001') = 1, 'une carte simple = une révision');
select pg_temp.check((select count(*) from card_schedules where card_id = 'ca0dca0d-0000-0000-0000-000000000002') = 2, 'une carte inversée = deux sens');
select pg_temp.check((select array_agg(variant order by variant) from card_schedules where card_id = 'ca0dca0d-0000-0000-0000-000000000003') = '{1,2}', 'un texte à trous = un trou par révision');

-- Les progrès d'un trou qui reste sont gardés quand on modifie la carte
update card_schedules set state = 'revision', interval_days = 12 where card_id = 'ca0dca0d-0000-0000-0000-000000000003' and variant = 1;
update cards set front = 'La {{c1::Déclaration}} des droits.' where id = 'ca0dca0d-0000-0000-0000-000000000003';
select pg_temp.check((select count(*) from card_schedules where card_id = 'ca0dca0d-0000-0000-0000-000000000003') = 1
  and (select interval_days from card_schedules where card_id = 'ca0dca0d-0000-0000-0000-000000000003') = 12, 'modifier un texte à trous garde les progrès');
update cards set kind = 'basique', back = 'Liberté' where id = 'ca0dca0d-0000-0000-0000-000000000002';
select pg_temp.check((select count(*) from card_schedules where card_id = 'ca0dca0d-0000-0000-0000-000000000002') = 1, 'repasser en simple retire le sens inverse');

do $$ begin
  insert into cards (deck_id, kind, front) values ('dec0dec0-0000-0000-0000-000000000001', 'trous', 'Pas de trou ici');
  raise exception 'ÉCHEC : texte à trous sans trou';
exception when check_violation then raise notice 'ok  un texte à trous doit avoir un trou';
end $$;

insert into card_reviews (schedule_id, deck_id, rating, state_before)
  select id, 'dec0dec0-0000-0000-0000-000000000001', 3, 'nouvelle' from card_schedules where card_id = 'ca0dca0d-0000-0000-0000-000000000001';
insert into flashcard_settings (new_per_day) values (10);

-- Yanis ne voit rien et ne peut rien glisser dans les paquets de Chloé
reset role;
select pg_temp.as_user('f1a5f1a5-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from decks) + (select count(*) from cards) + (select count(*) from card_schedules)
  + (select count(*) from card_reviews) + (select count(*) from flashcard_settings) = 0, 'Yanis ne voit pas les fiches de Chloé');
do $$ begin
  insert into cards (deck_id, front, back) values ('dec0dec0-0000-0000-0000-000000000001', 'Intrus', 'x');
  raise exception 'ÉCHEC : carte ajoutée au paquet d''autrui';
exception when insufficient_privilege then raise notice 'ok  impossible d''ajouter une carte au paquet d''autrui';
end $$;
do $$ begin
  insert into card_schedules (card_id) values ('ca0dca0d-0000-0000-0000-000000000001');
  raise exception 'ÉCHEC : révision sur la carte d''autrui';
exception when insufficient_privilege then raise notice 'ok  impossible de réviser la carte d''autrui';
end $$;
update card_schedules set interval_days = 999;
delete from cards;

-- Yanis ne peut pas relier son paquet à la note privée d'un autre
insert into decks (id, title) values ('dec0dec0-0000-0000-0000-000000000002', 'Anglais');
do $$ begin
  update decks set notebook_id = (select gen_random_uuid()) where id = 'dec0dec0-0000-0000-0000-000000000002';
  raise exception 'ÉCHEC : paquet relié à un carnet invisible';
exception when insufficient_privilege then raise notice 'ok  un paquet ne se relie qu''à un carnet visible';
end $$;

reset role;
select pg_temp.as_user('f1a5f1a5-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) from cards) = 3 and (select max(interval_days) from card_schedules) = 12, 'les fiches de Chloé sont intactes');

-- Connecteur IA : fermé tant que « flashcards » n'est pas coché
insert into ai_access (spaces) values ('{notes}');
select set_config('request.jwt.claims', '{"client_id":"claude-test"}', false);
select pg_temp.check((select count(*) from decks) = 0, 'IA : ne voit pas les flashcards fermées');
select set_config('request.jwt.claims', '', false);
update ai_access set spaces = '{notes,flashcards}';
select set_config('request.jwt.claims', '{"client_id":"claude-test"}', false);
select pg_temp.check((select count(*) from decks) = 1, 'IA : voit les flashcards une fois ouvertes');
insert into cards (deck_id, front, back, source, status) values ('dec0dec0-0000-0000-0000-000000000001', 'Qui ?', 'Robespierre', 'ia', 'a-verifier');
select pg_temp.check((select count(*) from cards where status = 'a-verifier') = 1, 'IA : propose une carte à vérifier');
select set_config('request.jwt.claims', '', false);

-- Supprimer le compte efface tout
reset role;
delete from auth.users where id = 'f1a5f1a5-0000-0000-0000-000000000001';
select pg_temp.check((select count(*) from decks where title = 'Révolution française') = 0 and (select count(*) from card_reviews) = 0, 'suppression du compte : tout est effacé');
reset role;
\echo 'Tests des Flashcards : ok.'
