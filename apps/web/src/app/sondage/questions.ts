/** Questions du sondage étudiants : une seule source pour le formulaire et la vérification serveur. */
export const Q = {
  filiere: ["PASS/LAS", "Santé (2e année et +)", "Droit", "Licence (autre)", "Prépa", "BTS/IUT", "Autre"],
  methodes: ["Relire le cours", "Faire des fiches", "Surligner", "Refaire des annales ou exercices", "Flashcards", "Me faire interroger", "Vidéos"],
  debut: ["La veille", "2-3 jours avant", "1 semaine avant", "2 semaines ou plus", "Tout au long du semestre"],
  oubli: ["Jamais", "Parfois", "Souvent", "Tout le temps"],
  usage_cartes: ["Jamais", "En papier", "Anki", "Quizlet", "Une autre appli"],
  frein: ["Trop long à créer", "Je ne sais pas bien les faire", "J'oublie de les revoir", "Les applis sont compliquées", "Rien"],
  prix: ["0 €", "1 à 2 €", "3 à 5 €", "Plus de 5 €"],
} as const;
