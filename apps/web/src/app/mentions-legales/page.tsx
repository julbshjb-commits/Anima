import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { A_COMPLETER, LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Mentions légales" };

export default function MentionsLegales() {
  return (
    <LegalPage title="Mentions légales">
      <h2>Éditeur</h2>
      <ul>
        <li>Nom : {LEGAL.editeur ?? A_COMPLETER}</li>
        <li>Statut : {LEGAL.statut ?? A_COMPLETER}</li>
        <li>Adresse : {LEGAL.adresse ?? A_COMPLETER}</li>
        <li>Contact : {LEGAL.contact ?? A_COMPLETER}</li>
        <li>Directeur de la publication : {LEGAL.editeur ?? A_COMPLETER}</li>
      </ul>

      <h2>Hébergement</h2>
      <ul>
        <li>
          Site web : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis (vercel.com). Traitement des
          pages configuré à Francfort.
        </li>
        <li>
          Données (base, photos, connexion) : Supabase Inc., 970 Toa Payoh North #07-04, Singapour 318992
          (supabase.com). Données stockées à Francfort, Allemagne.
        </li>
      </ul>
    </LegalPage>
  );
}
