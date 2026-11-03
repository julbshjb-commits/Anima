import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { A_COMPLETER, LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Politique de confidentialité" };

/**
 * Politique de confidentialité. Chaque phrase doit rester vraie au regard du
 * code : si une fonctionnalité change ce qui est collecté ou partagé, ce texte
 * change dans la même demande de fusion.
 */
export default function Confidentialite() {
  const contact = LEGAL.contact ?? A_COMPLETER;
  return (
    <LegalPage title="Politique de confidentialité">
      <p>
        Anima est un journal intime et un espace de journaux partagés. Ce que tu y écris t'appartient. Cette page
        explique, sans jargon, quelles données nous gardons, pourquoi, où, et comment les récupérer ou les effacer.
      </p>

      <h2>L'essentiel</h2>
      <ul>
        <li>
          Ton journal intime n'est visible que par toi dans Anima : aucun autre compte ne peut le lire. Il n'est pas
          chiffré de bout en bout ; l'équipe technique pourrait donc techniquement accéder à la base, et s'engage à ne
          jamais le faire, sauf obligation légale ou incident de sécurité.
        </li>
        <li>Un journal partagé n'est visible que par les personnes que tu as invitées avec un code.</li>
        <li>Pas de publicité, pas de revente de données, pas de traceurs publicitaires ni de mesure d'audience.</li>
        <li>Aucune intelligence artificielle ne lit tes journaux.</li>
        <li>Les données sont stockées dans l'Union européenne (Francfort, Allemagne).</li>
        <li>Tu peux exporter toutes tes données et supprimer ton compte à tout moment, depuis la page Compte.</li>
      </ul>

      <h2>Responsable du traitement</h2>
      <p>
        {LEGAL.editeur ?? A_COMPLETER}, joignable à {contact}. Les détails sont dans les{" "}
        <Link href="/mentions-legales">mentions légales</Link>.
      </p>

      <h2>Les données que nous gardons</h2>
      <ul>
        <li><strong>Ton compte</strong> : ton adresse e-mail et le prénom que tu affiches.</li>
        <li><strong>Tes journaux</strong> : leur titre, leur couverture, leurs membres et leurs rôles.</li>
        <li><strong>Tes entrées</strong> : date, titre, texte, humeur choisie, et les photos que tu ajoutes.</li>
        <li><strong>Les invitations</strong> : les codes sont enregistrés sous forme chiffrée (empreinte), jamais en clair, et expirent après 48 heures.</li>
        <li><strong>La sécurité</strong> : l'heure de chaque essai de code d'invitation, pour bloquer les essais en rafale.</li>
        <li><strong>Les journaux techniques</strong> de nos hébergeurs (adresse IP, date, page demandée), conservés peu de temps pour faire fonctionner et protéger le service.</li>
      </ul>
      <p>
        Nous ne te demandons ni ton âge, ni ton numéro de téléphone, ni ta position, ni l'accès à tes contacts. L'appli
        mobile n'accède à tes photos que lorsque tu choisis d'en ajouter une.
      </p>

      <h2>Pourquoi</h2>
      <p>
        Uniquement pour te fournir le service que tu as demandé : tenir ton journal et partager des journaux avec tes
        proches (base légale : exécution du contrat, article 6.1.b du RGPD). Les données de sécurité servent à protéger
        les comptes (intérêt légitime, article 6.1.f).
      </p>

      <h2>Qui y a accès</h2>
      <ul>
        <li>Toi, pour tout ce que tu as écrit.</li>
        <li>Les membres d'un journal partagé, pour les entrées et photos de ce journal uniquement.</li>
        <li>
          Nos sous-traitants techniques, qui hébergent le service sans pouvoir l'utiliser à leurs propres fins :
          <ul>
            <li><strong>Supabase</strong> : base de données, photos et connexion, hébergés à Francfort (Allemagne).</li>
            <li><strong>Vercel</strong> : affichage du site web. Les serveurs qui traitent tes pages sont configurés à Francfort ; Vercel étant une société américaine, des transferts hors UE peuvent avoir lieu, encadrés par les clauses contractuelles types de la Commission européenne.</li>
          </ul>
        </li>
      </ul>
      <p>Les photos sont stockées dans un espace privé et ne sont affichées que par des liens temporaires (une heure).</p>

      <h2>Combien de temps</h2>
      <p>
        Tant que ton compte existe. Quand tu supprimes une entrée, elle est effacée définitivement avec ses photos. Quand
        tu supprimes ton compte, ton profil, ton journal intime, tes entrées et tes photos sont effacés. Les journaux
        partagés que tu avais créés sont confiés au membre le plus ancien, pour que les autres gardent leurs propres
        souvenirs. Des copies peuvent subsister quelque temps dans les sauvegardes techniques de l'hébergeur avant d'être
        écrasées.
      </p>

      <h2>Cookies</h2>
      <p>
        Le site n'utilise que les cookies indispensables pour garder ta session ouverte. Aucun cookie publicitaire ni de
        mesure d'audience : c'est pourquoi il n'y a pas de bandeau de consentement.
      </p>

      <h2>Tes droits</h2>
      <p>
        Tu peux accéder à tes données, les corriger, les exporter, les effacer, t'opposer à un traitement ou en demander
        la limitation. L'export et la suppression se font directement depuis la page <strong>Compte</strong>. Pour toute
        autre demande, écris-nous à {contact} ; nous répondons sous un mois. Si tu estimes que tes droits ne sont pas
        respectés, tu peux saisir la CNIL (cnil.fr).
      </p>

      <h2>Âge</h2>
      <p>Anima s'adresse aux personnes de 15 ans et plus. En dessous, l'accord d'un parent est nécessaire.</p>

      <h2>Changements</h2>
      <p>
        Si cette politique change de façon importante, nous te prévenons dans l'appli avant que le changement
        s'applique.
      </p>
    </LegalPage>
  );
}
