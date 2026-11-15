"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Fine ligne champagne en haut de l'écran pendant qu'une page se charge :
 * on voit tout de suite que le toucher a été pris en compte, même si le
 * serveur met une seconde à répondre. Elle n'apparaît qu'après 120 ms, pour
 * ne pas clignoter quand la page est déjà prête.
 */
export function BarreChargement() {
  const path = usePathname();
  const [etat, setEtat] = useState<"repos" | "charge" | "fini">("repos");
  const depart = useRef<{ from: string; timer: number } | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      if (depart.current) clearTimeout(depart.current.timer);
      const from = location.pathname;
      depart.current = { from, timer: window.setTimeout(() => setEtat("charge"), 120) };
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    const d = depart.current;
    if (!d || d.from === path) return;
    clearTimeout(d.timer);
    depart.current = null;
    // La page est arrivée : la barre file jusqu'au bout puis s'efface.
    const t1 = window.setTimeout(() => setEtat((s) => (s === "charge" ? "fini" : s)), 0);
    const t2 = window.setTimeout(() => setEtat("repos"), 450);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [path]);

  // Filet de sécurité : jamais de barre coincée.
  useEffect(() => {
    if (etat !== "charge") return;
    const t = window.setTimeout(() => setEtat("repos"), 12000);
    return () => clearTimeout(t);
  }, [etat]);

  return <div aria-hidden className="barre-chargement" data-etat={etat} />;
}
