"use client";
import { useActionState } from "react";
import { envoyerSondage, type SondageState } from "./actions";
import { Q } from "./questions";
import { btn, card, input } from "@/components/ui";

const choix = "flex items-center gap-3 rounded-2xl border border-trait bg-papier px-4 py-3 text-sm cursor-pointer has-[:checked]:border-champagne has-[:checked]:bg-surface-2";

function Bloc({ n, titre, aide, children }: { n: number; titre: string; aide?: string; children: React.ReactNode }) {
  return (
    <fieldset className={`${card} p-5 flex flex-col gap-3`}>
      <legend className="sr-only">{titre}</legend>
      <p className="font-medium">
        <span className="text-doux mr-2">{n}.</span>
        {titre}
      </p>
      {aide && <p className="text-xs text-doux -mt-2">{aide}</p>}
      {children}
    </fieldset>
  );
}
function Radios({ name, options }: { name: string; options: readonly string[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => (
        <label key={o} className={choix}>
          <input type="radio" name={name} value={o} required className="accent-[#d4ad6c]" />
          {o}
        </label>
      ))}
    </div>
  );
}
function Echelle({ name }: { name: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((v) => (
          <label key={v} className={`${choix} justify-center`}>
            <input type="radio" name={name} value={v} required className="sr-only" />
            {v}
          </label>
        ))}
      </div>
      <div className="flex justify-between text-xs text-doux">
        <span>Pas du tout</span>
        <span>Énormément</span>
      </div>
    </div>
  );
}

export function SondageForm() {
  const [state, action, pending] = useActionState<SondageState, FormData>(envoyerSondage, { status: "idle" });
  if (state.status === "ok")
    return (
      <div role="status" className={`${card} p-8 flex flex-col gap-3 text-center`}>
        <p className="titre text-3xl">Merci !</p>
        <p className="text-doux">Tes réponses vont vraiment nous aider à construire une appli de révision qui te ressemble.</p>
      </div>
    );
  return (
    <form action={action} className="flex flex-col gap-4">
      <Bloc n={1} titre="Tu es en :"><Radios name="filiere" options={Q.filiere} /></Bloc>
      <Bloc n={2} titre="Comment tu révises le plus souvent ?" aide="Plusieurs choix possibles.">
        <div className="grid gap-2 sm:grid-cols-2">
          {Q.methodes.map((o) => (
            <label key={o} className={choix}>
              <input type="checkbox" name="methodes" value={o} className="accent-[#d4ad6c]" />
              {o}
            </label>
          ))}
        </div>
      </Bloc>
      <Bloc n={3} titre="Tu commences à réviser un partiel :"><Radios name="debut" options={Q.debut} /></Bloc>
      <Bloc n={4} titre="Le jour du partiel, tu oublies ce que tu avais révisé :"><Radios name="oubli" options={Q.oubli} /></Bloc>
      <Bloc n={5} titre="Tu as déjà utilisé des flashcards ?"><Radios name="usage_cartes" options={Q.usage_cartes} /></Bloc>
      <Bloc n={6} titre="Ce qui te freine avec les flashcards :"><Radios name="frein" options={Q.frein} /></Bloc>
      <Bloc n={7} titre="Une appli qui transforme ton cours en flashcards et te dit chaque jour quoi revoir, ça t'aiderait ?"><Echelle name="utilite" /></Bloc>
      <Bloc n={8} titre="Réviser le même paquet de cartes que toute ta promo, partagé avec un code ?"><Echelle name="promo" /></Bloc>
      <Bloc n={9} titre="Combien tu paierais par mois pour ça ?"><Radios name="prix" options={Q.prix} /></Bloc>
      <Bloc n={10} titre="Qu'est-ce qui t'énerve le plus quand tu révises ?" aide="Réponse libre, facultative.">
        <textarea name="enerve" rows={3} maxLength={1000} className={`${input} h-auto py-3`} placeholder="Dis-nous tout…" />
      </Bloc>
      <fieldset className={`${card} p-5 flex flex-col gap-3`}>
        <p className="font-medium">Préviens-moi au lancement <span className="text-doux font-normal">(facultatif)</span></p>
        <input name="email" type="email" autoComplete="email" placeholder="prenom@exemple.fr" className={input} />
        <label className="flex items-start gap-3 text-xs text-doux">
          <input type="checkbox" name="accord_email" className="mt-0.5 accent-[#d4ad6c]" />
          J'accepte de recevoir un seul e-mail d'Anima au lancement. Mon adresse ne sert à rien d'autre et je peux demander sa suppression à tout moment.
        </label>
      </fieldset>
      {state.status === "error" && <p role="alert" className="text-sm text-terre">{state.message}</p>}
      <button type="submit" className={btn} disabled={pending}>{pending ? "Envoi…" : "Envoyer mes réponses"}</button>
    </form>
  );
}
