import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { A_COMPLETER, LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Conditions d'utilisation" };

export default function Conditions() {
  return (
    <LegalPage title="Conditions d'utilisation">
      <p>
        Ces conditions encadrent l'utilisation d'Anima, sur le web et sur mobile. En créant un compte, tu les acceptes.
        Elles complètent la <Link href="/confidentialite">politique de confidentialité</Link>.
      </p>

      <h2>Le service</h2>
      <p>
        Anima permet de tenir un journal intime privé et de partager des journaux avec des personnes que tu invites. Le
        service est gratuit pendant sa phase de lancement. Si une offre payante apparaît un jour, elle sera optionnelle,
        annoncée à l'avance, et ne retirera rien de ce que tu as déjà écrit.
      </p>

      <h2>Ton compte</h2>
      <ul>
        <li>La connexion se fait par e-mail, sans mot de passe : garde l'accès à ta boîte mail pour toi.</li>
        <li>Un compte est personnel. Tu es responsable de ce qui est écrit depuis ton compte.</li>
        <li>Anima s'adresse aux personnes de 15 ans et plus ; en dessous, avec l'accord d'un parent.</li>
      </ul>

      <h2>Ce que tu écris</h2>
      <p>
        Tes textes et tes photos restent à toi. Tu nous autorises seulement à les stocker et à les afficher aux personnes
        que tu as choisies (toi seul pour le journal intime, les membres pour un journal partagé), le temps nécessaire au
        service. Nous ne les utilisons à aucune autre fin.
      </p>

      <h2>Journaux partagés</h2>
      <ul>
        <li>Un code d'invitation donne accès à tout le journal concerné : ne le transmets qu'aux personnes voulues.</li>
        <li>Chaque membre ne peut modifier ou supprimer que ses propres entrées.</li>
        <li>Respecte les autres membres : pas de contenu illégal, haineux, harcelant, ni de photo d'une personne publiée contre son gré.</li>
        <li>Si tu quittes un journal partagé, tes entrées y restent visibles pour les autres membres : supprime-les avant si tu le souhaites. Si tu supprimes ton compte, toutes tes entrées sont effacées.</li>
      </ul>

      <h2>Disponibilité</h2>
      <p>
        Nous faisons de notre mieux pour qu'Anima fonctionne en continu et pour protéger tes données, sans pouvoir
        garantir l'absence totale d'interruption ou d'erreur. Pense à exporter régulièrement tes souvenirs les plus
        précieux depuis la page Compte.
      </p>

      <h2>Fin d'utilisation</h2>
      <p>
        Tu peux supprimer ton compte à tout moment. Nous pouvons suspendre un compte qui enfreint gravement ces
        conditions ou la loi, après t'avoir prévenu sauf urgence.
      </p>

      <h2>Droit applicable</h2>
      <p>
        Ces conditions sont soumises au droit français. En cas de désaccord, écris-nous d'abord à{" "}
        {LEGAL.contact ?? A_COMPLETER} pour trouver une solution amiable, avant toute autre démarche.
      </p>
    </LegalPage>
  );
}
