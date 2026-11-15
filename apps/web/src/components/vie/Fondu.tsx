import { ViewTransition } from "react";

/**
 * Passage en douceur d'une page à l'autre : l'ancienne s'efface vite, la
 * nouvelle monte légèrement en fondu (animations « page » dans globals.css).
 * Utilisé dans les template.tsx, qui sont recréés à chaque changement de page.
 */
export function Fondu({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page" exit="page" default="none">
      {children}
    </ViewTransition>
  );
}
