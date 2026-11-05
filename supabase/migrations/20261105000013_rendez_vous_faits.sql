-- Agenda : on peut cocher un rendez-vous comme fait (demande de Nassim, 5 novembre 2026).
-- Une seule colonne, vide par défaut : rien ne change pour les rendez-vous existants.
alter table public.events add column done_at timestamptz;
