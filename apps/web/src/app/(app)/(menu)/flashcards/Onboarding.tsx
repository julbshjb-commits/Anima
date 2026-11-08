"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { createDeck } from "./actions";
import { field } from "./Forms";

const MATIERES = ["Médecine", "Droit", "Anglais", "Espagnol", "Histoire", "Biologie", "Maths", "Économie", "Philosophie"];

/**
 * Premier lancement, en deux temps : la matière (et la date de l'examen),
 * puis le premier cours transformé en cartes. Rien n'est créé avant le choix final.
 */
export function Onboarding() {
  const [step, setStep] = useState<1 | 2>(1);
  const [subject, setSubject] = useState("");
  const [exam, setExam] = useState("");
  const [state, action, pending] = useActionState(createDeck, {});
  const picked = subject.trim();
  const query = new URLSearchParams({ matiere: picked, ...(exam ? { examen: exam } : {}) }).toString();

  return (
    <section className="entree relative isolate overflow-hidden rounded-2xl bg-[#111112] border border-champagne/25 shadow-[0_40px_90px_-50px_rgba(230,200,145,.45)] text-blanc p-7 lg:p-10 flex flex-col gap-7 max-w-4xl">
      <div className="halo" aria-hidden>
        <i />
        <i />
        <i />
      </div>
      <div className="voile" aria-hidden />

      <div className="relative flex items-center gap-3">
        <p className="surtitre !text-blanc/80">Premier pas · {step} sur 2</p>
        <span className="flex gap-1.5" aria-hidden>
          <i className={`block h-1 w-8 rounded-full ${step >= 1 ? "bg-champagne" : "bg-blanc/15"}`} />
          <i className={`block h-1 w-8 rounded-full transition-colors duration-500 ${step === 2 ? "bg-champagne" : "bg-blanc/15"}`} />
        </span>
      </div>

      {step === 1 ? (
        <form
          key="matiere"
          className="entree relative flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (picked) setStep(2);
          }}
        >
          <h2 className="titre text-[38px] lg:text-[50px] leading-[1.02]">
            Quelle matière <em className="italic champagne pr-1">tu révises ?</em>
          </h2>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Matières courantes">
            {MATIERES.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={picked === m}
                onClick={() => setSubject(m)}
                className={`h-10 px-4 rounded-full text-sm border transition-all duration-200 ${
                  picked === m ? "bg-champagne text-nuit border-champagne font-semibold shadow-[0_10px_30px_-12px_rgba(224,184,120,.8)]" : "border-blanc/15 text-blanc/85 hover:border-champagne/50 hover:-translate-y-0.5"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="grid sm:grid-cols-[minmax(0,1fr)_220px] gap-3">
            <label className="flex flex-col gap-1.5 text-xs text-blanc/60">
              Ou écris-la
              <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={80} placeholder="Anatomie, droit des contrats, japonais…" className={field} />
            </label>
            <label className="flex flex-col gap-1.5 text-xs text-blanc/60">
              Ton prochain examen (facultatif)
              <input type="date" value={exam} onChange={(e) => setExam(e.target.value)} className={field} />
            </label>
          </div>
          <div>
            <button
              type="submit"
              disabled={!picked}
              className="bouton-or inline-flex items-center h-12 px-7 rounded-full text-nuit text-sm font-semibold shadow-[0_14px_40px_-12px_rgba(224,184,120,.7)] disabled:opacity-40 disabled:shadow-none"
            >
              Continuer
            </button>
          </div>
        </form>
      ) : (
        <div key="cours" className="entree relative flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="titre text-[38px] lg:text-[50px] leading-[1.02]">
              Transforme ton premier cours <em className="italic champagne pr-1">en cartes</em>
            </h2>
            <p className="text-[15px] text-blanc/70">
              {picked}
              {exam ? ` · examen le ${new Date(`${exam}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}` : ""}
              {" · "}
              <button type="button" onClick={() => setStep(1)} className="underline underline-offset-4 decoration-blanc/30 hover:text-champagne">
                changer
              </button>
            </p>
          </div>
          <ul className="grid md:grid-cols-3 gap-3">
            <li style={{ ["--i" as string]: 1 }} className="entree">
              <Link
                href={`/flashcards/generer?${query}`}
                className="souleve h-full rounded-2xl border border-champagne/45 bg-champagne/[.08] p-5 flex flex-col gap-2 hover:bg-champagne/[.12]"
              >
                <span className="text-[11px] tracking-[0.14em] uppercase text-champagne">Conseillé</span>
                <span className="titre text-[24px] leading-tight">Coller un cours ou importer un PDF</span>
                <span className="text-[13px] text-blanc/65 leading-relaxed">Anima te propose des cartes tirées du texte. Tu relis, tu corriges, tu gardes.</span>
              </Link>
            </li>
            <li style={{ ["--i" as string]: 2 }} className="entree">
              <Link href="/flashcards/ajouter" className="souleve h-full rounded-2xl border border-blanc/12 bg-blanc/[.03] p-5 flex flex-col gap-2 hover:border-champagne/40">
                <span className="text-[11px] tracking-[0.14em] uppercase text-blanc/50">Avec ta promo</span>
                <span className="titre text-[24px] leading-tight">J'ai un code de paquet</span>
                <span className="text-[13px] text-blanc/65 leading-relaxed">Ajoute le paquet d'un camarade. Tes réponses et tes progrès restent à toi.</span>
              </Link>
            </li>
            <li style={{ ["--i" as string]: 3 }} className="entree">
              <form action={action} className="h-full">
                <input type="hidden" name="title" value={picked} />
                <input type="hidden" name="subject" value={picked} />
                <input type="hidden" name="exam_date" value={exam} />
                <button
                  type="submit"
                  disabled={pending}
                  className="souleve w-full h-full text-left rounded-2xl border border-blanc/12 bg-blanc/[.03] p-5 flex flex-col gap-2 hover:border-champagne/40"
                >
                  <span className="text-[11px] tracking-[0.14em] uppercase text-blanc/50">À la main</span>
                  <span className="titre text-[24px] leading-tight">{pending ? "Création du paquet…" : "Écrire mes cartes"}</span>
                  <span className="text-[13px] text-blanc/65 leading-relaxed">Crée le paquet « {picked} » et ajoute tes questions une par une.</span>
                </button>
              </form>
            </li>
          </ul>
          {state.error && (
            <p role="alert" className="text-sm text-terre">
              {state.error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
