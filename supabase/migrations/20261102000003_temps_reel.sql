-- Temps réel : les membres d'un journal voient arriver les nouvelles entrées.
-- Supabase Realtime applique la RLS de journal_entries à chaque abonné :
-- seuls les membres du journal reçoivent les événements.
alter publication supabase_realtime add table public.journal_entries;
