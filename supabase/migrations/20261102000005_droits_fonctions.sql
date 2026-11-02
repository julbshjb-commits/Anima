-- Durcissement signalé par le linter de sécurité Supabase.
--
-- Par défaut, toute fonction du schéma public peut être appelée sans être
-- connecté (rôles PUBLIC et anon), via /rest/v1/rpc/. Les nôtres ne renvoient
-- rien d'utile sans session, mais on ferme la porte : seuls les utilisateurs
-- connectés peuvent les exécuter, et uniquement celles dont ils ont besoin
-- (les politiques RLS appellent les fonctions d'aide avec le rôle de l'appelant).

revoke execute on all functions in schema public from public, anon;
alter default privileges in schema public revoke execute on functions from public, anon;

-- Fonctions d'aide utilisées par les politiques RLS (tables et stockage).
grant execute on function public.journal_role_of(uuid) to authenticated;
grant execute on function public.is_journal_member(uuid) to authenticated;
grant execute on function public.can_write_journal(uuid) to authenticated;
grant execute on function public.shares_a_journal_with(uuid) to authenticated;
grant execute on function public.storage_journal_id(text) to authenticated;
grant execute on function public.hash_invite_code(text) to authenticated;

-- Actions appelées par l'appli.
grant execute on function public.create_journal_invite(uuid) to authenticated;
grant execute on function public.join_journal_with_code(text) to authenticated;
grant execute on function public.revoke_journal_invite(uuid) to authenticated;
grant execute on function public.leave_journal(uuid) to authenticated;
grant execute on function public.prepare_account_deletion() to authenticated;

-- Réservée au serveur.
revoke execute on function public.generate_invite_code() from authenticated;
