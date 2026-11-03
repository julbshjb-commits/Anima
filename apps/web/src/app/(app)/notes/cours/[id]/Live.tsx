"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/browser";

/**
 * Les passages de la promo arrivent en direct : Supabase Realtime, filtré par
 * la RLS de note_blocks (seuls les membres du carnet reçoivent les événements).
 */
export function LiveSeance({ notebookId }: { notebookId: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = browserClient();
    if (!supabase) return;
    const channel = supabase
      .channel(`carnet:${notebookId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "note_blocks",
          filter: `notebook_id=eq.${notebookId}`,
        },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [notebookId, router]);
  return null;
}

export function PrintButton({ label = "Exporter en PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="h-10 px-4 rounded-full border border-noir/15 text-sm font-medium hover:bg-lin print:hidden"
    >
      {label}
    </button>
  );
}
