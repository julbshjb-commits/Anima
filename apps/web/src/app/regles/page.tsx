import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { A_COMPLETER, LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Règles de la communauté" };

export default function Regles() {
  return (
    <LegalPage title="Règles de la communauté">
      <p>
        Le réseau Anima est un endroit calme, pour partager ce qui nous anime. Ces règles s&apos;appliquent à tout ce qui est publié : profils,
        publications, photos et commentaires. Elles complètent les <Link href="/conditions">conditions d&apos;utilisation</Link>.
      </p>

      <h2>Ce qui reste privé</h2>
      <ul>
        <li>Ton journal intime n&apos;est jamais publiable. Tes journaux partagés, notes et cercles restent privés.</li>
        <li>Rien n&apos;arrive sur le réseau sans que tu appuies toi-même sur « Publier ».</li>
        <li>Ton profil public est séparé de ton compte. Tu peux quitter le réseau à tout moment : tout ce que tu y as publié est effacé.</li>
      </ul>

      <h2>Qui peut rejoindre</h2>
      <p>Le réseau est réservé aux personnes de 15 ans et plus. Un profil qui semble appartenir à un enfant plus jeune est suspendu.</p>

      <h2>Ce qui est interdit</h2>
      <ul>
        <li>Le harcèlement, les menaces, les moqueries répétées envers une personne.</li>
        <li>Les propos haineux visant une origine, une religion, un genre, une orientation, un handicap.</li>
        <li>La nudité, le contenu sexuel, et tout contenu qui met en danger un mineur.</li>
        <li>La violence choquante, l&apos;incitation à se faire du mal ou à faire du mal.</li>
        <li>Le spam, les arnaques, la publicité non sollicitée, les faux comptes qui imitent quelqu&apos;un.</li>
        <li>Publier des informations privées sur une autre personne sans son accord (adresse, téléphone, photos).</li>
      </ul>

      <h2>Comment on fait respecter ces règles</h2>
      <ul>
        <li>Chaque publication, commentaire ou profil peut être signalé en deux gestes, depuis le menu « ⋯ ».</li>
        <li>Quand trois personnes différentes signalent un même contenu, il est masqué tout de suite, en attendant que l&apos;équipe Anima regarde.</li>
        <li>L&apos;équipe Anima peut retirer un contenu et suspendre un profil. Un filtre bloque aussi certains mots avant la publication.</li>
        <li>Tu peux bloquer quelqu&apos;un : vous ne voyez plus rien l&apos;un de l&apos;autre, et vos abonnements sont retirés.</li>
      </ul>

      <h2>Si tu vas mal</h2>
      <p>
        Si une publication t&apos;inquiète pour quelqu&apos;un, signale-la avec « Autre chose » et quelques mots. En France, le 3114 répond jour et nuit,
        gratuitement, à toute personne en détresse.
      </p>

      <h2>Nous écrire</h2>
      <p>Pour contester une décision ou signaler un problème grave : {LEGAL.contact ?? A_COMPLETER}.</p>
    </LegalPage>
  );
}
