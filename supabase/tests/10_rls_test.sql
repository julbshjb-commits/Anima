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
delete from journal_entries where id = 'eeeeeeee-0000-0000-0000-000000000001';
reset role;
select pg_temp.check(exists (select 1 from journal_entries where id = 'eeeeeeee-0000-0000-0000-000000000001'), 'Léa ne peut pas supprimer l''entrée de Nassim');

-- Léa modifie puis supprime sa propre entrée
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
do $$ declare v uuid; begin
  update journal_entries set content_text = 'La soupe sauvée', mood = 'lumineux'
  where content_text = 'La soupe ratée' returning id into v;
  if v is null then raise exception 'ÉCHEC : Léa ne peut pas modifier son entrée'; end if;
  raise notice 'ok  Léa modifie sa propre entrée';
  delete from journal_entries where id = v;
  if exists (select 1 from journal_entries where id = v) then raise exception 'ÉCHEC : entrée non supprimée'; end if;
  raise notice 'ok  Léa supprime sa propre entrée';
end $$;
reset role;
select pg_temp.check(not exists (select 1 from journal_entries where content_text = 'La soupe sauvée'), 'l''entrée supprimée a vraiment disparu de la base');
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
update journals set title = 'Renommé' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
reset role;
select pg_temp.check((select title from journals where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'Nous deux', 'seul le propriétaire renomme le journal');

-- Stockage : Léa peut déposer une photo dans le journal partagé, pas dans l'intime
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
insert into storage.objects (bucket_id, name, owner_id)
values ('attachments', 'aaaaaaaa-0000-0000-0000-000000000001/x/photo.jpg', auth.uid()::text);
do $$ begin
  insert into storage.objects (bucket_id, name, owner_id)
  values ('attachments', 'aaaaaaaa-0000-0000-0000-000000000002/x/photo.jpg', auth.uid()::text);
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

-- Création depuis l'appli : INSERT ... RETURNING doit renvoyer le journal créé
reset role;
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
do $$ declare v uuid; begin
  insert into journals (owner_id, title, kind) values (auth.uid(), 'Carnet d''Ève', 'amis') returning id into v;
  if v is null then raise exception 'ÉCHEC : RETURNING vide à la création'; end if;
  if not public.is_journal_member(v) then raise exception 'ÉCHEC : la créatrice n''est pas membre'; end if;
  raise notice 'ok  la créatrice récupère son journal et en devient membre';
end $$;

-- Changer de propriétaire à la main reste interdit
reset role;
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
do $$ begin
  update journals set owner_id = '11111111-1111-1111-1111-111111111111' where title = 'Carnet d''Ève';
  raise exception 'ÉCHEC : changement de propriétaire accepté';
exception when insufficient_privilege then raise notice 'ok  impossible de changer le propriétaire à la main';
end $$;

-- Suppression de compte : le journal partagé est transmis au membre suivant
reset role;
insert into journal_members (journal_id, user_id, role)
  select id, '11111111-1111-1111-1111-111111111111', 'editor' from journals where title = 'Carnet d''Ève';
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select prepare_account_deletion();
reset role;
delete from auth.users where id = '33333333-3333-3333-3333-333333333333';
select pg_temp.check(
  (select owner_id from journals where title = 'Carnet d''Ève') = '11111111-1111-1111-1111-111111111111',
  'après suppression du compte d''Ève, Nassim hérite du carnet partagé');
select pg_temp.check(
  (select role from journal_members m join journals j on j.id = m.journal_id
   where j.title = 'Carnet d''Ève' and m.user_id = '11111111-1111-1111-1111-111111111111') = 'owner',
  'Nassim devient propriétaire dans la liste des membres');

-- Sans être connecté, aucune fonction n'est appelable
reset role;
set role anon;
do $$ begin
  perform public.is_journal_member('aaaaaaaa-0000-0000-0000-000000000001');
  raise exception 'ÉCHEC : anon peut appeler une fonction';
exception when insufficient_privilege then raise notice 'ok  sans session, les fonctions sont fermées';
end $$;

reset role;
\echo 'Tous les tests de règles d''accès passent.'

-- ---------------------------------------------------------------------
-- M'organiser : tout est personnel
-- ---------------------------------------------------------------------
reset role;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
insert into projects (id, title, color) values ('99999999-0000-0000-0000-000000000001', 'Partiels', 'pensif');
insert into tasks (id, title, project_id, due_date) values ('99999999-0000-0000-0000-0000000000a1', 'Rendre la fiche TD 4', '99999999-0000-0000-0000-000000000001', current_date);
insert into events (title, starts_at) values ('Cours d''économie', now());
insert into rituals (id, title) values ('99999999-0000-0000-0000-0000000000b1', 'Lire 20 minutes');
insert into ritual_checks (ritual_id, day) values ('99999999-0000-0000-0000-0000000000b1', current_date);
select pg_temp.check((select owner_id from tasks where id = '99999999-0000-0000-0000-0000000000a1') = auth.uid(), 'une tâche appartient à sa créatrice');

reset role;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.check((select count(*) from projects) = 0, 'Léa ne voit pas les projets de Nassim');
select pg_temp.check((select count(*) from tasks) = 0, 'Léa ne voit pas les tâches de Nassim');
select pg_temp.check((select count(*) from events) = 0, 'Léa ne voit pas l''agenda de Nassim');
select pg_temp.check((select count(*) from rituals) = 0 and (select count(*) from ritual_checks) = 0, 'Léa ne voit pas les rituels de Nassim');
update tasks set title = 'Piraté' where id = '99999999-0000-0000-0000-0000000000a1';
delete from tasks where id = '99999999-0000-0000-0000-0000000000a1';

-- Léa ne peut pas ranger sa tâche dans le projet de Nassim
do $$ begin
  insert into tasks (title, project_id) values ('Intrusion', '99999999-0000-0000-0000-000000000001');
  raise exception 'ÉCHEC : tâche rangée dans le projet d''autrui';
exception when insufficient_privilege then raise notice 'ok  impossible d''utiliser le projet d''autrui';
end $$;
-- Ni cocher un rituel de Nassim
do $$ begin
  insert into ritual_checks (ritual_id, day) values ('99999999-0000-0000-0000-0000000000b1', current_date - 1);
  raise exception 'ÉCHEC : rituel d''autrui coché';
exception when insufficient_privilege then raise notice 'ok  impossible de cocher le rituel d''autrui';
end $$;
-- Ni créer une tâche au nom de Nassim
do $$ begin
  insert into tasks (owner_id, title) values ('11111111-1111-1111-1111-111111111111', 'Pour toi');
  raise exception 'ÉCHEC : tâche créée pour autrui';
exception when insufficient_privilege then raise notice 'ok  impossible de créer une tâche pour autrui';
end $$;

reset role;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select pg_temp.check((select title from tasks where id = '99999999-0000-0000-0000-0000000000a1') = 'Rendre la fiche TD 4', 'la tâche de Nassim est intacte');
reset role;

-- ---------------------------------------------------------------------
-- Notes : carnets personnels fermés, carnets de cours partagés par code
-- ---------------------------------------------------------------------
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('44444444-4444-4444-4444-444444444444', 'sami@example.org', '{"display_name":"Sami"}');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
insert into notebooks (id, title, kind) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Économie', 'perso'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Droit constitutionnel', 'cours');
insert into notes (id, notebook_id, title, body, tags) values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'L''offre et la demande', 'Prix d''équilibre', '{partiels}'),
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'Le contrôle de constitutionnalité', '', '{}');
insert into note_blocks (note_id, notebook_id, content) values
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'I. Le contrôle a priori');
select pg_temp.check((select role from notebook_members where notebook_id = 'bbbbbbbb-0000-0000-0000-000000000002' and user_id = auth.uid()) = 'owner', 'le créateur d''un carnet en est propriétaire');

-- Un carnet personnel ne se partage pas
do $$ begin
  perform create_notebook_invite('bbbbbbbb-0000-0000-0000-000000000001');
  raise exception 'ÉCHEC : invitation sur carnet perso';
exception when insufficient_privilege then raise notice 'ok  un carnet personnel ne peut pas être partagé';
end $$;

create temp table nb_code as select code from create_notebook_invite('bbbbbbbb-0000-0000-0000-000000000002');
grant select on nb_code to authenticated;

-- Sami ne voit rien avant d'avoir le code
reset role;
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select pg_temp.check((select count(*) from notebooks) = 0 and (select count(*) from notes) = 0 and (select count(*) from note_blocks) = 0, 'sans invitation, Sami ne voit aucun carnet ni note');
do $$ begin
  insert into note_blocks (note_id, notebook_id, content) values ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'Intrus');
  raise exception 'ÉCHEC : passage ajouté sans être membre';
exception when insufficient_privilege then raise notice 'ok  impossible d''écrire dans une séance sans être membre';
end $$;
do $$ begin
  insert into tasks (title, note_id) values ('Espionner', 'cccccccc-0000-0000-0000-000000000001');
  raise exception 'ÉCHEC : tâche liée à une note inaccessible';
exception when insufficient_privilege then raise notice 'ok  impossible de lier une tâche à la note d''autrui';
end $$;

-- Sami rejoint le carnet de cours avec le code
select pg_temp.check((join_with_code((select code from nb_code)) ->> 'type') = 'carnet', 'le code fait rejoindre le carnet de cours');
select pg_temp.check((select count(*) from notebooks) = 1, 'Sami voit le carnet de cours, pas le carnet perso');
select pg_temp.check((select count(*) from notes) = 1, 'Sami voit la séance, pas la note perso');
select pg_temp.check((select display_name from profiles where id = '11111111-1111-1111-1111-111111111111') = 'Nassim', 'les membres du carnet voient le nom des autres');
insert into note_blocks (id, note_id, notebook_id, kind, content) values
  ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'question', 'Le partiel porte-t-il sur la séance 6 ?');
select pg_temp.check((select notebook_id from note_blocks where id = 'dddddddd-0000-0000-0000-000000000001') = 'bbbbbbbb-0000-0000-0000-000000000002', 'le carnet d''un passage est recopié de la séance, pas choisi par le client');
-- Sami ne modifie pas le passage de Nassim, ni la séance
update note_blocks set content = 'Piraté' where content = 'I. Le contrôle a priori';
update notes set title = 'Piraté' where id = 'cccccccc-0000-0000-0000-000000000002';
-- Mais il peut cocher une question
select toggle_question('dddddddd-0000-0000-0000-000000000001');
-- Et créer une tâche née de la séance
insert into tasks (title, note_id) values ('Relire la séance', 'cccccccc-0000-0000-0000-000000000002');

reset role;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select pg_temp.check((select content from note_blocks where note_id = 'cccccccc-0000-0000-0000-000000000002' and kind = 'texte') = 'I. Le contrôle a priori', 'chacun ne modifie que ses propres passages');
select pg_temp.check((select title from notes where id = 'cccccccc-0000-0000-0000-000000000002') = 'Le contrôle de constitutionnalité', 'un membre ne renomme pas la séance d''un autre');
select pg_temp.check((select done_at is not null from note_blocks where id = 'dddddddd-0000-0000-0000-000000000001'), 'un membre peut cocher une question');
select pg_temp.check((select count(*) from tasks where note_id is not null) = 0, 'la tâche de Sami reste à Sami');

-- Léa, qui partage un journal avec Nassim, ne voit pas ses notes
reset role;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.check((select count(*) from notebooks) = 0 and (select count(*) from notes) = 0, 'partager un journal ne donne pas accès aux notes');
select pg_temp.check((select count(*) from profiles where id = '44444444-4444-4444-4444-444444444444') = 0, 'Léa ne voit pas le profil de Sami');

-- Suppression du compte de Nassim : Sami hérite du carnet de cours, la séance reste
reset role;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select prepare_account_deletion();
reset role;
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
select pg_temp.check((select owner_id from notebooks where id = 'bbbbbbbb-0000-0000-0000-000000000002') = '44444444-4444-4444-4444-444444444444', 'Sami hérite du carnet de cours');
select pg_temp.check((select count(*) from notes where id = 'cccccccc-0000-0000-0000-000000000002') = 1, 'la séance commune survit, sans autrice');
select pg_temp.check((select count(*) from notebooks where id = 'bbbbbbbb-0000-0000-0000-000000000001') = 0, 'le carnet perso disparaît avec le compte');
select pg_temp.check((select count(*) from note_blocks where id = 'dddddddd-0000-0000-0000-000000000001') = 1, 'les passages de Sami restent');
reset role;
\echo 'Tests des Notes : ok.'

-- ---------------------------------------------------------------------
-- Cercles : on n'entre que par code, tout reste dans le cercle
-- ---------------------------------------------------------------------
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('55555555-5555-5555-5555-555555555555', 'maxime@example.org', '{"display_name":"Maxime"}');

select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
insert into circles (id, name) values ('ffffffff-0000-0000-0000-000000000001', 'Les copains de prépa');
insert into circle_posts (id, circle_id, body, event_title, event_day, event_end_day) values
  ('ffffffff-0000-0000-0000-0000000000a1', 'ffffffff-0000-0000-0000-000000000001', 'Qui est chaud pour Strasbourg ?', 'Week-end à Strasbourg', '2026-12-12', '2026-12-13');
select pg_temp.check((select role from circle_members where circle_id = 'ffffffff-0000-0000-0000-000000000001' and user_id = auth.uid()) = 'owner', 'la créatrice d''un cercle en est propriétaire');
create temp table circle_code as select code from create_circle_invite('ffffffff-0000-0000-0000-000000000001');
grant select on circle_code to authenticated;

-- Léa ne voit rien sans le code, ne peut ni réagir ni commenter
reset role;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.check((select count(*) from circles) = 0 and (select count(*) from circle_posts) = 0, 'sans code, Léa ne voit ni le cercle ni ses publications');
do $$ begin
  insert into circle_comments (post_id, circle_id, body) values ('ffffffff-0000-0000-0000-0000000000a1', 'ffffffff-0000-0000-0000-000000000001', 'Intruse');
  raise exception 'ÉCHEC : commentaire hors du cercle';
exception when insufficient_privilege then raise notice 'ok  impossible de commenter sans être membre';
end $$;
do $$ begin
  insert into events (title, starts_at, circle_post_id) values ('Copie', now(), 'ffffffff-0000-0000-0000-0000000000a1');
  raise exception 'ÉCHEC : événement copié hors du cercle';
exception when insufficient_privilege then raise notice 'ok  impossible de copier l''événement d''un cercle dont on n''est pas membre';
end $$;

-- Léa rejoint avec le code
select pg_temp.check((join_with_code((select code from circle_code)) ->> 'type') = 'cercle', 'le code fait rejoindre le cercle');
select pg_temp.check((select count(*) from circle_posts) = 1, 'Léa voit la publication du cercle');
insert into circle_reactions (post_id, circle_id, kind) values ('ffffffff-0000-0000-0000-0000000000a1', 'ffffffff-0000-0000-0000-000000000001', 'jensuis');
insert into circle_comments (id, post_id, circle_id, body) values ('ffffffff-0000-0000-0000-0000000000c1', 'ffffffff-0000-0000-0000-0000000000a1', 'ffffffff-0000-0000-0000-000000000001', 'Je prends les billets');
insert into events (title, starts_at, circle_post_id) values ('Week-end à Strasbourg', '2026-12-12 09:00+01', 'ffffffff-0000-0000-0000-0000000000a1');
select pg_temp.check((select count(*) from events where circle_post_id is not null) = 1, 'Léa ajoute l''événement à son agenda');
-- Léa ne modifie pas la publication de Sami
update circle_posts set body = 'Piraté' where id = 'ffffffff-0000-0000-0000-0000000000a1';
-- Ni ne retire Sami du cercle
delete from circle_members where user_id = '44444444-4444-4444-4444-444444444444';

reset role;
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select pg_temp.check((select body from circle_posts where id = 'ffffffff-0000-0000-0000-0000000000a1') = 'Qui est chaud pour Strasbourg ?', 'un membre ne modifie pas la publication d''un autre');
select pg_temp.check((select count(*) from circle_members where circle_id = 'ffffffff-0000-0000-0000-000000000001') = 2, 'un membre ne retire personne du cercle');
select pg_temp.check((select count(*) from events) = 0, 'l''agenda de Léa reste à Léa');
select pg_temp.check((select display_name from profiles where id = '22222222-2222-2222-2222-222222222222') = 'Léa', 'les membres d''un cercle voient le nom des autres');
-- La créatrice modère : elle peut retirer le commentaire de Léa
delete from circle_comments where id = 'ffffffff-0000-0000-0000-0000000000c1';
select pg_temp.check((select count(*) from circle_comments) = 0, 'la créatrice du cercle peut retirer un commentaire');

-- Maxime, hors du cercle, ne voit pas le profil de Léa
reset role;
select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
select pg_temp.check((select count(*) from profiles where id = '22222222-2222-2222-2222-222222222222') = 0, 'hors du cercle, on ne voit pas les profils des membres');
select pg_temp.check((select count(*) from circle_reactions) = 0, 'hors du cercle, on ne voit pas les réactions');

-- Suppression du compte de Sami : Léa hérite du cercle
reset role;
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select prepare_account_deletion();
reset role;
delete from auth.users where id = '44444444-4444-4444-4444-444444444444';
select pg_temp.check((select owner_id from circles where id = 'ffffffff-0000-0000-0000-000000000001') = '22222222-2222-2222-2222-222222222222', 'Léa hérite du cercle');
reset role;
\echo 'Tests des Cercles : ok.'

-- ---------------------------------------------------------------------
-- Bibliothèque : tout est personnel
-- ---------------------------------------------------------------------
reset role;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
insert into works (id, title, creator, status, progress, progress_total) values
  ('abcdabcd-0000-0000-0000-000000000001', 'Les Années', 'Annie Ernaux', 'en-cours', 158, 254);
insert into quotes (work_id, text, source) values ('abcdabcd-0000-0000-0000-000000000001', 'Sauver quelque chose du temps où l''on ne sera plus jamais.', 'p. 254');
insert into reading_goals (year, target) values (2026, 24);
do $$ begin
  update works set progress = 300 where id = 'abcdabcd-0000-0000-0000-000000000001';
  raise exception 'ÉCHEC : page au-delà du total';
exception when check_violation then raise notice 'ok  la page lue ne dépasse pas le total';
end $$;

reset role;
select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
select pg_temp.check((select count(*) from works) = 0 and (select count(*) from quotes) = 0 and (select count(*) from reading_goals) = 0, 'Maxime ne voit pas la bibliothèque de Léa');
do $$ begin
  insert into quotes (work_id, text) values ('abcdabcd-0000-0000-0000-000000000001', 'Intrus');
  raise exception 'ÉCHEC : citation rattachée à l''œuvre d''autrui';
exception when insufficient_privilege then raise notice 'ok  impossible de rattacher une citation à l''œuvre d''autrui';
end $$;
update works set title = 'Piraté' where id = 'abcdabcd-0000-0000-0000-000000000001';
reset role;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.check((select title from works where id = 'abcdabcd-0000-0000-0000-000000000001') = 'Les Années', 'l''œuvre de Léa est intacte');
reset role;
\echo 'Tests de la Bibliothèque : ok.'
