import type { Metadata } from "next";
import { JoinForm } from "./JoinForm";

export const metadata: Metadata = { title: "Rejoindre un journal" };

export default function Rejoindre() {
  return (
    <main className="max-w-3xl px-5 py-8 lg:px-12 lg:pt-10 flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="surtitre">Invitation</p>
        <h1 className="titre text-[44px] leading-[1.05]">Rejoindre un journal</h1>
        <p className="text-doux">Entre le code qu'on t'a envoyé. Il est valable 48 heures.</p>
      </div>
      <JoinForm />
    </main>
  );
}
