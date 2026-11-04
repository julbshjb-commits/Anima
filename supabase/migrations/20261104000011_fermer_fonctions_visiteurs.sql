-- Signalé par le linter de sécurité Supabase le 4 novembre 2026.
--
-- Supabase redonne le droit d'exécution au rôle anon pour chaque nouvelle
-- fonction : les fonctions créées par les migrations 7 à 10 pouvaient donc être
-- appelées sans être connecté. Elles ne renvoyaient rien sans session
-- (auth.uid() est vide), mais on referme la porte comme à la migration 5.
-- Les droits donnés à authenticated ne changent pas.

revoke execute on all functions in schema public from public, anon;
