"use client";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Fait apparaître son contenu en douceur quand il entre à l'écran.
 * Sans JavaScript, ou si l'on préfère moins d'animations, tout reste visible.
 */
export function Revele({ children, className = "", delai = 0, as: Tag = "div" }: { children: ReactNode; className?: string; delai?: number; as?: "div" | "section" | "li" }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    el.dataset.revele = "attente";
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        el.dataset.revele = "vu";
        io.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref as never} className={`revele ${className}`} style={{ transitionDelay: `${delai}ms` }}>
      {children}
    </Tag>
  );
}
