-- Tests des règles d'accès. Chaque vérification lève une erreur en cas d'échec.
\set ON_ERROR_STOP on

-- Trois personnes : Nassim, Léa (partenaire) et Ève (une inconnue).
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'nassim@example.org', '{"display_name":"Nassim"}'),
  ('22222222-2222-2222-2222-222222222222', 'lea@example.org',    '{"display_name":"Léa"}'),
  ('33333333-3333-3333-3333-333333333333', 'eve@example.org',    '{}');

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

-- Profil créé à l'inscription, nom par défaut tiré de l'e-mail
select pg_temp.check((select display_name from profiles where id = '33333333-3333-3333-3333-333333333333') = 'eve', 'profil créé avec le nom tiré de l''e-mail');

-- Nassim crée un journal de couple et son journal intime
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
insert into journals (id, owner_id, title, kind) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Nous deux', 'couple'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Mon journal intime', 'intime');
select pg_temp.check((select role from journal_members where journal_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = auth.uid()) = 'owner', 'le créateur devient propriétaire');

insert into journal_entries (id, journal_id, author_id, content_text, mood) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', auth.uid(), 'Le pain du dimanche', 'serein'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', auth.uid(), 'Secret', 'pensif');

-- Impossible de créer un journal au nom de quelqu'un d'autre
do $$ begin
  insert into journals (owner_id, title, kind) values ('22222222-2222-2222-2222-222222222222', 'Pirate', 'amis');
  raise exception 'ÉCHEC : journal créé pour autrui';
exception when insufficient_privilege then raise notice 'ok  impossible de créer un journal pour autrui';
end $$;

-- Un seul journal intime par personne
do $$ begin
  insert into journals (owner_id, title, kind) values (auth.uid(), 'Deuxième intime', 'intime');
  raise exception 'ÉCHEC : deux journaux intimes';
exception when unique_violation then raise notice 'ok  un seul journal intime par personne';
end $$;

-- Le journal intime ne peut pas être partagé
do $$ begin
  perform create_journal_invite('aaaaaaaa-0000-0000-0000-000000000002');
  raise exception 'ÉCHEC : invitation sur journal intime';
exception when insufficient_privilege then raise notice 'ok  le journal intime ne peut pas être partagé';
end $$;

-- Code d'invitation pour le journal de couple
create temp table invite_code as select code from create_journal_invite('aaaaaaaa-0000-0000-0000-000000000001');
grant select on invite_code to authenticated;
select pg_temp.check((select code ~ '^[A-HJKMNP-Z2-9]{6}$' from invite_code), 'code à 6 caractères sans ambiguïté');
select pg_temp.check((select count(*) from journal_invites i, invite_code c where i.code_hash = c.code) = 0, 'le code n''est pas stocké en clair');

-- Ève (inconnue) ne voit rien
reset role;
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select pg_temp.check((select count(*) from journals) = 0, 'une inconnue ne voit aucun journal');
select pg_temp.check((select count(*) from journal_entries) = 0, 'une inconnue ne voit aucune entrée');
select pg_temp.check((select count(*) from profiles) = 1, 'une inconnue ne voit que son propre profil');
select pg_temp.check((select count(*) from journal_invites) = 0, 'une inconnue ne voit aucune invitation');
do $$ begin
  insert into journal_entries (journal_id, author_id, content_text)
  values ('aaaaaaaa-0000-0000-0000-000000000001', auth.uid(), 'intrusion');
  raise exception 'ÉCHEC : écriture par une inconnue';
exception when insufficient_privilege then raise notice 'ok  une inconnue ne peut pas écrire';
end $$;

-- Ève tente des codes au hasard : limitée à 5 par heure
select pg_temp.check(join_journal_with_code('AAAAAA') is null, 'mauvais code refusé');
select join_journal_with_code('BBBBBB'); select join_journal_with_code('CCCCCC'); select join_journal_with_code('DDDDDD'); select join_journal_with_code('EEEEEE');
do $$ begin
  perform join_journal_with_code('FFFFFF');
  raise exception 'ÉCHEC : pas de limite de débit';
exception when sqlstate '54000' then raise notice 'ok  limite de 5 tentatives par heure';
end $$;

-- Léa rejoint avec le bon code
reset role;
select set_config('test.code', (select code from invite_code), false);
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.check(join_journal_with_code(lower(current_setting('test.code'))) = 'aaaaaaaa-0000-0000-0000-000000000001', 'Léa rejoint avec le code (insensible à la casse)');
select pg_temp.check((select count(*) from journals) = 1, 'Léa voit le journal partagé et pas le journal intime de Nassim');
select pg_temp.check((select count(*) from journal_entries) = 1, 'Léa voit l''entrée partagée et pas l''entrée intime');
select pg_temp.check((select count(*) from profiles) = 2, 'Léa voit le profil de Nassim');

-- Léa écrit, mais ne peut ni modifier l'entrée de Nassim ni le journal
insert into journal_entries (journal_id, author_id, content_text, mood)
values ('aaaaaaaa-0000-0000-0000-000000000001', auth.uid(), 'La soupe ratée', 'tendre');
update journal_entries set content_text = 'modifié' where id = 'eeeeeeee-0000-0000-0000-000000000001';
reset role;
select pg_temp.check((select content_text from journal_entries where id = 'eeeeeeee-0000-0000-0000-000000000001') = 'Le pain du dimanche', 'Léa ne peut pas modifier l''entrée de Nassim');
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
update journals set title = 'Renommé' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
reset role;
select pg_temp.check((select title from journals where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'Nous deux', 'seul le propriétaire renomme le journal');

-- Stockage : Léa peut déposer une photo dans le journal partagé, pas dans l'intime
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
insert into storage.objects (bucket_id, name, owner)
values ('attachments', 'aaaaaaaa-0000-0000-0000-000000000001/x/photo.jpg', auth.uid());
do $$ begin
  insert into storage.objects (bucket_id, name, owner)
  values ('attachments', 'aaaaaaaa-0000-0000-0000-000000000002/x/photo.jpg', auth.uid());
  raise exception 'ÉCHEC : dépôt dans le journal intime d''autrui';
exception when insufficient_privilege then raise notice 'ok  pas de dépôt de fichier dans le journal d''autrui';
end $$;
reset role;
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select pg_temp.check((select count(*) from storage.objects) = 0, 'une inconnue ne voit aucune photo');

-- Léa quitte le journal : elle ne voit plus rien
reset role;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select leave_journal('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) from journals) = 0, 'après départ, Léa ne voit plus le journal');

reset role;
\echo 'Tous les tests de règles d''accès passent.'
