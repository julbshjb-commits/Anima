"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/browser";

/**
 * Écoute les nouvelles entrées du journal (Supabase Realtime, filtré par la RLS)
 * et rafraîchit la page quand un membre écrit.
 */
export function LiveRefresh({ journalId }: { journalId: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = browserClient();
    if (!supabase) return;
    const channel = supabase
      .channel(`journal:${journalId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "journal_entries", filter: `journal_id=eq.${journalId}` },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [journalId, router]);
  return null;
}
