-- Rappel quotidien des flashcards : l'heure choisie sur le téléphone (HH:MM, heure de Paris),
-- ou null pour aucun rappel. Le téléphone programme lui-même la notification.
alter table public.flashcard_settings
  add column rappel_heure text
  check (rappel_heure is null or rappel_heure ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
