# ADR 0002 — Accès aux données

Date : 2 novembre 2026 · Statut : accepté

## Principes

1. **Privé par défaut.** Un journal n'est visible que par ses membres. Le journal intime n'a qu'un membre et ne peut pas recevoir d'invitation (refus en base).
2. **Autorisations explicites.** On entre dans un journal partagé uniquement avec un code d'invitation : 6 caractères sans ambiguïté, stocké haché (SHA-256), valable 48 h, 10 utilisations au plus, 5 essais par heure et par personne.
3. **Contrôle côté serveur.** Les règles vivent dans Postgres (RLS + fonctions `security definer` au `search_path` vide). L'interface ne fait que refléter ce que la base autorise.
4. **Pièces jointes privées.** Bucket `attachments` non public ; le premier dossier du chemin est l'identifiant du journal, et les politiques du stockage vérifient l'appartenance. Lecture par liens signés d'une heure.
5. **Pas d'accès de l'IA aux journaux privés** sans consentement explicite (aucune IA dans cette version).

## Rôles

| Rôle | Lire | Écrire ses entrées | Inviter | Renommer / supprimer le journal |
| --- | --- | --- | --- | --- |
| owner | oui | oui | oui | oui |
| editor | oui | oui | oui | non |
| reader | oui | non | non | non |

Chacun ne modifie ou ne supprime que ses propres entrées.

## Suppression de compte

`prepare_account_deletion()` transmet chaque journal partagé créé par la personne au membre le plus ancien, puis le serveur efface ses photos et supprime l'utilisateur. Le journal intime et les entrées de la personne disparaissent par cascade. Changer de propriétaire en dehors de cette fonction est refusé par un trigger.

## Export

`/compte/export` renvoie en JSON le profil, les journaux dont on est membre, les entrées écrites et la liste des photos (RGPD, article 20).

## Tests

`supabase/tests/10_rls_test.sql` vérifie ces règles avec trois personnes (Nassim, Léa, et Ève qui n'est invitée nulle part).
