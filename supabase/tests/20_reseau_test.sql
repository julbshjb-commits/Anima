-- Tests du réseau public (migration 14).
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1000000-0000-0000-0000-000000000001', 'zoe@example.org',  '{"display_name":"Zoé"}'),
  ('a1000000-0000-0000-0000-000000000002', 'yann@example.org', '{"display_name":"Yann"}'),
  ('a1000000-0000-0000-0000-000000000003', 'xena@example.org', '{"display_name":"Xéna"}'),
  ('a1000000-0000-0000-0000-000000000004', 'walt@example.org', '{"display_name":"Walt"}'),
  ('a1000000-0000-0000-0000-000000000005', 'vera@example.org', '{"display_name":"Véra"}');

create or replace function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', false);
  perform set_config('request.jwt.claim.sub', p::text, false);
  execute 'set role authenticated';
end $$;

create or replace function pg_temp.check(cond boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'ÉCHEC : %', label; end if;
  raise notice 'ok  %', label;
end $$;

-- Zoé : compte public
select pg_temp.as_user('a1000000-0000-0000-0000-000000000001');
insert into public_profiles (id, handle, name, bio) values (auth.uid(), '  Zoe.Lit ', 'Zoé', 'Je lis');
select pg_temp.check((select handle from public_profiles where id = auth.uid()) = 'zoe.lit', 'pseudo mis en minuscules');
do $$ begin
  insert into public_profiles (id, handle, name) values ('a1000000-0000-0000-0000-000000000002', 'pirate', 'Pirate');
  raise exception 'ÉCHEC : profil public créé pour autrui';
exception when insufficient_privilege then raise notice 'ok  impossible de créer le profil public d''autrui';
end $$;
do $$ begin
  update public_profiles set followers_count = 999, suspended_at = now() where id = auth.uid();
  raise exception 'ÉCHEC : compteurs modifiables';
exception when insufficient_privilege then raise notice 'ok  compteurs et suspension non modifiables';
end $$;
insert into posts (id, body, mood) values ('b1000000-0000-0000-0000-000000000001', 'Premier jour de neige', 'serein');
select pg_temp.check((select posts_count from public_profiles where id = auth.uid()) = 1, 'compteur de publications');

-- Yann : pseudo pris, pseudo réservé, puis compte privé
select pg_temp.as_user('a1000000-0000-0000-0000-000000000002');
select pg_temp.check(not handle_available('zoe.lit') and not handle_available('anima') and handle_available('yann'), 'disponibilité des pseudos');
do $$ begin
  insert into public_profiles (id, handle, name) values (auth.uid(), 'anima', 'Faux');
  raise exception 'ÉCHEC : pseudo réservé accepté';
exception when check_violation then raise notice 'ok  pseudo réservé refusé';
end $$;
-- Sans profil public, on ne peut ni publier ni suivre
do $$ begin
  insert into posts (body) values ('Sans profil');
  raise exception 'ÉCHEC : publication sans profil public';
exception when foreign_key_violation then raise notice 'ok  publier demande un profil public';
end $$;
insert into public_profiles (id, handle, name, is_private) values (auth.uid(), 'yann', 'Yann', true);
insert into posts (id, body) values ('b1000000-0000-0000-0000-000000000002', 'Réservé à mes abonnés');
-- Yann suit Zoé (public) : accepté tout de suite
insert into follows (followee_id) values ('a1000000-0000-0000-0000-000000000001');
select pg_temp.check((select status from follows where followee_id = 'a1000000-0000-0000-0000-000000000001') = 'accepted', 'suivre un compte public');
insert into post_likes (post_id) values ('b1000000-0000-0000-0000-000000000001');
insert into post_comments (post_id, body) values ('b1000000-0000-0000-0000-000000000001', 'Magnifique');

-- Zoé voit le j'aime, le commentaire et les notifications, mais pas la publication privée de Yann
select pg_temp.as_user('a1000000-0000-0000-0000-000000000001');
select pg_temp.check((select likes_count = 1 and comments_count = 1 from posts where id = 'b1000000-0000-0000-0000-000000000001'), 'compteurs j''aime et commentaires');
select pg_temp.check((select followers_count from public_profiles where id = auth.uid()) = 1, 'compteur d''abonnés');
select pg_temp.check((select count(*) from notifications) = 3, 'notifications abonnement, j''aime, commentaire');
select pg_temp.check((select count(*) from public_profiles where handle = 'yann') = 1, 'en-tête d''un compte privé visible');
select pg_temp.check(not exists (select 1 from posts where id = 'b1000000-0000-0000-0000-000000000002'), 'publication d''un compte privé cachée');
-- Zoé demande à suivre Yann : en attente
insert into follows (followee_id) values ('a1000000-0000-0000-0000-000000000002');
select pg_temp.check((select status from follows where followee_id = 'a1000000-0000-0000-0000-000000000002') = 'pending', 'demande d''abonnement à un compte privé');
update follows set status = 'accepted' where followee_id = 'a1000000-0000-0000-0000-000000000002';
select pg_temp.check((select status from follows where followee_id = 'a1000000-0000-0000-0000-000000000002') = 'pending', 'on ne s''accepte pas soi-même');
select pg_temp.check(not exists (select 1 from posts where id = 'b1000000-0000-0000-0000-000000000002'), 'toujours cachée pendant la demande');
do $$ begin
  update posts set likes_count = 500 where id = 'b1000000-0000-0000-0000-000000000001';
  raise exception 'ÉCHEC : compteur de j''aime modifiable';
exception when insufficient_privilege then raise notice 'ok  compteur de j''aime non modifiable';
end $$;

-- Yann accepte
select pg_temp.as_user('a1000000-0000-0000-0000-000000000002');
update follows set status = 'accepted' where follower_id = 'a1000000-0000-0000-0000-000000000001';
select pg_temp.as_user('a1000000-0000-0000-0000-000000000001');
select pg_temp.check(exists (select 1 from posts where id = 'b1000000-0000-0000-0000-000000000002'), 'publication visible une fois accepté');
select pg_temp.check(exists (select 1 from notifications where kind = 'follow_accepted'), 'notification d''acceptation');

-- Xéna (sans profil public) ne voit rien du compte privé ; Zoé la bloque
select pg_temp.as_user('a1000000-0000-0000-0000-000000000003');
select pg_temp.check((select count(*) from posts) = 1, 'un inconnu ne voit que les publications publiques');
insert into public_profiles (id, handle, name) values (auth.uid(), 'xena', 'Xéna');
insert into follows (followee_id) values ('a1000000-0000-0000-0000-000000000001');
select pg_temp.as_user('a1000000-0000-0000-0000-000000000001');
insert into blocks (blocked_id) values ('a1000000-0000-0000-0000-000000000003');
select pg_temp.as_user('a1000000-0000-0000-0000-000000000003');
select pg_temp.check((select count(*) from posts) = 0, 'bloquée : ne voit plus les publications');
select pg_temp.check(not exists (select 1 from public_profiles where handle = 'zoe.lit'), 'bloquée : ne voit plus le profil');
select pg_temp.check(not exists (select 1 from follows where follower_id = auth.uid()), 'bloquer retire l''abonnement');
do $$ begin
  insert into follows (followee_id) values ('a1000000-0000-0000-0000-000000000001');
  raise exception 'ÉCHEC : abonnement malgré le blocage';
exception when insufficient_privilege then raise notice 'ok  impossible de suivre qui nous bloque';
end $$;

-- Trois signalements masquent la publication de Zoé
insert into public_profiles (id, handle, name) select 'a1000000-0000-0000-0000-000000000004', 'walt', 'Walt' where false;
select pg_temp.as_user('a1000000-0000-0000-0000-000000000002');
insert into reports (target_kind, target_id, reason) values ('post', 'b1000000-0000-0000-0000-000000000001', 'spam');
select pg_temp.as_user('a1000000-0000-0000-0000-000000000004');
insert into reports (target_kind, target_id, reason) values ('post', 'b1000000-0000-0000-0000-000000000001', 'spam');
select pg_temp.check((select count(*) from reports) = 1, 'on ne voit que ses propres signalements');
select pg_temp.check(exists (select 1 from posts where id = 'b1000000-0000-0000-0000-000000000001'), 'deux signalements ne masquent pas');
select pg_temp.as_user('a1000000-0000-0000-0000-000000000005');
insert into reports (target_kind, target_id, reason) values ('post', 'b1000000-0000-0000-0000-000000000001', 'haine');
select pg_temp.check(not exists (select 1 from posts where id = 'b1000000-0000-0000-0000-000000000001'), 'trois signalements masquent');
select pg_temp.as_user('a1000000-0000-0000-0000-000000000001');
select pg_temp.check(exists (select 1 from posts where id = 'b1000000-0000-0000-0000-000000000001' and hidden_at is not null), 'l''autrice voit sa publication masquée');
do $$ begin
  perform moderate('post', 'b1000000-0000-0000-0000-000000000001', 'garde');
  raise exception 'ÉCHEC : modération sans être de l''équipe';
exception when insufficient_privilege then raise notice 'ok  modération réservée à l''équipe';
end $$;

-- Walt est de l'équipe : il remet la publication en ligne
reset role;
insert into app_admins (user_id) values ('a1000000-0000-0000-0000-000000000004');
select pg_temp.as_user('a1000000-0000-0000-0000-000000000004');
select pg_temp.check((select count(*) from reports where resolved_at is null) = 3, 'l''équipe voit tous les signalements');
select moderate('post', 'b1000000-0000-0000-0000-000000000001', 'garde');
select pg_temp.check((select hidden_at is null from posts where id = 'b1000000-0000-0000-0000-000000000001'), 'publication remise en ligne');
select pg_temp.check((select count(*) from reports where resolved_at is null) = 0, 'signalements clos');

-- Les assistants IA ne voient rien du réseau
select pg_temp.as_user('a1000000-0000-0000-0000-000000000001');
select set_config('request.jwt.claims', '{"client_id":"claude-test"}', false);
select pg_temp.check((select count(*) from posts) = 0 and (select count(*) from public_profiles) = 0, 'IA : aucun accès au réseau');
select set_config('request.jwt.claims', '', false);

-- Supprimer son profil public efface ses publications
delete from public_profiles where id = auth.uid();
reset role;
select pg_temp.check(not exists (select 1 from posts where author_id = 'a1000000-0000-0000-0000-000000000001'), 'quitter le réseau efface les publications');
select pg_temp.check((select following_count from public_profiles where id = 'a1000000-0000-0000-0000-000000000002') = 0, 'compteur d''abonnements remis à jour');
\echo 'Tests du réseau public : ok.'
