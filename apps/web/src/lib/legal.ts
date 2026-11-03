/**
 * Informations légales. Les champs `null` doivent être remplis par l'éditeur
 * (Nassim) avant la mise en production : tant qu'ils sont vides, les pages
 * affichent clairement « à compléter » au lieu d'inventer une identité.
 */
export const LEGAL = {
  /** Nom de la personne ou de la société qui édite Anima. */
  editeur: null as string | null,
  /** Statut : « particulier », « micro-entreprise », « SAS »… et SIRET le cas échéant. */
  statut: null as string | null,
  /** Adresse postale de l'éditeur. */
  adresse: null as string | null,
  /** Adresse e-mail de contact, aussi utilisée pour les demandes RGPD. */
  contact: null as string | null,
  /** Date de dernière mise à jour des textes. */
  miseAJour: "3 novembre 2026",
};

export const A_COMPLETER = "[à compléter]";
