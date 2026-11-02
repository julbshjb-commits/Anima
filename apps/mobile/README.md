# Anima mobile (iPhone et Android)

Appli Expo (SDK 58, expo-router). Même base Supabase et mêmes règles d'accès que le web : l'appli n'embarque que la clé publique, c'est la RLS de Postgres qui décide de ce que chacun voit.

## Ce qui marche

- Connexion sans mot de passe par **code à 6 chiffres** reçu par e-mail (le web utilise un lien).
- Liste des journaux : journal intime (créé à la première ouverture) et journaux partagés.
- Calendrier du mois coloré par humeur, entrées avec photos, mise à jour en temps réel.
- Écrire une entrée : date, humeur, titre, texte, jusqu'à 4 photos (10 Mo chacune) envoyées dans le stockage privé.
- Créer un journal partagé, générer un code d'invitation (48 h) et l'envoyer, rejoindre avec un code.
- Modifier ou supprimer une entrée (par son auteur seulement).
- Compte : prénom affiché, déconnexion, **suppression du compte** (fonction serveur `supabase/functions/supprimer-compte`, à déployer sur Supabase).

## Pas encore dans l'appli

- Export des données : sur le site web pour l'instant (bouton affiché seulement si `EXPO_PUBLIC_SITE_URL` est rempli).
- Éditeur riche (Tiptap), notifications.

## Réglage Supabase obligatoire

Pour que le code apparaisse dans l'e-mail : Supabase → Authentication → Emails → modèle **Magic Link**, ajouter `{{ .Token }}` dans le texte, par exemple :

```html
<p>Ton code de connexion Anima : <strong>{{ .Token }}</strong></p>
<p>Ou clique sur ce lien depuis ton ordinateur : <a href="{{ .ConfirmationURL }}">me connecter</a></p>
```

Le même modèle sert au web (lien) et au mobile (code).

## Lancer

```bash
cp .env.example .env
pnpm --filter @anima/mobile start
```

Vérifications avant une PR : `pnpm --filter @anima/mobile typecheck` et `pnpm --filter @anima/mobile lint`.
