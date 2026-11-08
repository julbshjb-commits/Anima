import type { Metadata } from "next";
import { JoinForm } from "./JoinForm";

export const metadata: Metadata = { title: "Rejoindre avec un code" };

export default function Rejoindre() {
  return (
    <main className="max-w-3xl px-5 py-8 lg:px-12 lg:pt-10 flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="surtitre">Invitation</p>
        <h1 className="titre text-[44px] leading-[1.05]">Rejoindre avec un code</h1>
        <p className="text-doux">Entre le code qu'on t'a envoyé : un paquet de flashcards de ta promo, un carnet de cours, un journal partagé ou un cercle. Les invitations sont valables 48 heures, les codes de paquet tant que leur auteur les garde.</p>
      </div>
      <JoinForm />
    </main>
  );
}
