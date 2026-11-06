"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  cardSchema,
  deckSchema,
  draftCardSchema,
  extractDraftCards,
  reviewWrite,
  settingsSchema,
  type DraftCard,
  type Rating,
} from "@anima/core";
import { requireUser } from "@/lib/auth";
import { aiCardsAvailable, generateCards } from "@/lib/ia-cartes";

export type FlashState = { error?: string; ok?: number };

const uuid = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null);
const refresh = (deckId?: string | null) => {
  revalidatePath("/flashcards");
  if (deckId) revalidatePath("/flashcards/paquet");
};
const fields = (form: FormData) => Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith("$")));

/* Paquets ---------------------------------------------------------------- */

export async function createDeck(_: FlashState, form: FormData): Promise<FlashState> {
  const { supabase } = await requireUser();
  const parsed = deckSchema.safeParse(fields(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Paquet invalide." };
  const { data, error } = await supabase.from("decks").insert(parsed.data).select("id").single();
  if (error || !data) return { error: "Le paquet n'a pas pu être créé. Réessaie." };
  revalidatePath("/flashcards");
  redirect(`/flashcards/paquet?id=${data.id}`);
}

export async function updateDeck(_: FlashState, form: FormData): Promise<FlashState> {
  const { supabase } = await requireUser();
  const id = uuid(form.get("id"));
  if (!id) return { error: "Paquet introuvable." };
  const parsed = deckSchema.safeParse(fields(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Paquet invalide." };
  const { error, count } = await supabase.from("decks").update(parsed.data, { count: "exact" }).eq("id", id);
  if (error || !count) return { error: "Les modifications n'ont pas pu être enregistrées." };
  refresh(id);
  return { ok: Date.now() };
}

export async function deleteDeck(form: FormData) {
  const { supabase } = await requireUser();
  const id = uuid(form.get("id"));
  if (id) await supabase.from("decks").delete().eq("id", id);
  revalidatePath("/flashcards");
  redirect("/flashcards");
}

/* Cartes ----------------------------------------------------------------- */

export async function addCard(_: FlashState, form: FormData): Promise<FlashState> {
  const { supabase } = await requireUser();
  const deckId = uuid(form.get("deckId"));
  if (!deckId) return { error: "Choisis un paquet." };
  const parsed = cardSchema.safeParse({ kind: form.get("kind"), front: form.get("front"), back: form.get("back") ?? "", tags: form.get("tags") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Carte invalide." };
  const { error } = await supabase.from("cards").insert({ ...parsed.data, deck_id: deckId, note_id: uuid(form.get("noteId")) });
  if (error) return { error: "La carte n'a pas pu être ajoutée." };
  refresh(deckId);
  return { ok: Date.now() };
}

export async function updateCard(_: FlashState, form: FormData): Promise<FlashState> {
  const { supabase } = await requireUser();
  const id = uuid(form.get("id"));
  const deckId = uuid(form.get("deckId"));
  if (!id) return { error: "Carte introuvable." };
  const parsed = cardSchema.safeParse({ kind: form.get("kind"), front: form.get("front"), back: form.get("back") ?? "", tags: form.get("tags") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Carte invalide." };
  const approve = form.get("approve") === "1" ? { status: "active" as const } : {};
  const { error, count } = await supabase.from("cards").update({ ...parsed.data, ...approve }, { count: "exact" }).eq("id", id);
  if (error || !count) return { error: "Les modifications n'ont pas pu être enregistrées." };
  refresh(deckId);
  return { ok: Date.now() };
}

export async function deleteCard(form: FormData) {
  const { supabase } = await requireUser();
  const id = uuid(form.get("id"));
  if (id) await supabase.from("cards").delete().eq("id", id);
  refresh(uuid(form.get("deckId")));
}

export async function toggleSuspend(form: FormData) {
  const { supabase } = await requireUser();
  const id = uuid(form.get("id"));
  if (id) await supabase.from("cards").update({ suspended: form.get("suspended") === "1" }).eq("id", id);
  refresh(uuid(form.get("deckId")));
}

/** Remet une carte à zéro : elle redevient nouvelle. */
export async function resetCard(form: FormData) {
  const { supabase } = await requireUser();
  const id = uuid(form.get("id"));
  if (id)
    await supabase
      .from("card_schedules")
      .update({ state: "nouvelle", step: 0, interval_days: 0, ease: 2.5, reps: 0, lapses: 0, due_at: new Date().toISOString(), last_reviewed_at: null })
      .eq("card_id", id);
  refresh(uuid(form.get("deckId")));
}

/** Garde les cartes proposées (par l'IA du connecteur) : elles entrent en révision. */
export async function approveCards(form: FormData) {
  const { supabase } = await requireUser();
  const deckId = uuid(form.get("deckId"));
  const ids = form.getAll("id").map(uuid).filter((x): x is string => !!x);
  if (deckId && form.get("all") === "1") await supabase.from("cards").update({ status: "active" }).eq("deck_id", deckId).eq("status", "a-verifier");
  else if (ids.length) await supabase.from("cards").update({ status: "active" }).in("id", ids);
  refresh(deckId);
}

/* Brouillons (repérage ou IA) -------------------------------------------- */

export type DraftResult = { error?: string; cards?: DraftCard[]; via?: "auto" | "ia" };

/** Brouillons tirés d'une note ou d'un document (texte ou PDF) du disque. */
export async function draftFromSource(source: { note?: string; file?: string }, mode: "auto" | "ia"): Promise<DraftResult> {
  const { supabase } = await requireUser();
  let title = "";
  let text = "";
  let pdf: string | null = null;
  const noteId = uuid(source.note);
  const fileId = uuid(source.file);
  if (noteId) {
    const { data: note } = await supabase.from("notes").select("id, title, body").eq("id", noteId).maybeSingle();
    if (!note) return { error: "Note introuvable." };
    const { data: blocks } = await supabase.from("note_blocks").select("content").eq("note_id", noteId).order("created_at").limit(500);
    title = note.title;
    text = [note.body, ...(blocks ?? []).map((b) => b.content)].filter(Boolean).join("\n").trim();
  } else if (fileId) {
    const { data: file } = await supabase.from("files").select("name, storage_path, mime_type, size_bytes").eq("id", fileId).is("trashed_at", null).maybeSingle();
    if (!file) return { error: "Document introuvable." };
    const isPdf = file.mime_type === "application/pdf";
    if (!isPdf && !file.mime_type.startsWith("text/")) return { error: "Seuls les PDF et les fichiers texte peuvent devenir des cartes." };
    if (file.size_bytes > 20 * 1024 * 1024) return { error: "Document trop lourd (20 Mo au plus)." };
    if (isPdf && mode === "auto") return { error: "Un PDF se lit avec l'IA. Le repérage automatique marche sur les notes et les fichiers texte." };
    const { data: blob } = await supabase.storage.from("fichiers").download(file.storage_path);
    if (!blob) return { error: "Le document n'a pas pu être lu." };
    title = file.name;
    if (isPdf) pdf = Buffer.from(await blob.arrayBuffer()).toString("base64");
    else text = (await blob.text()).trim();
  } else return { error: "Choisis une note ou un document." };
  if (!pdf && !text) return { error: "Ce contenu est vide." };
  if (mode === "auto") {
    const cards = extractDraftCards(text);
    return cards.length
      ? { cards, via: "auto" }
      : { error: "Aucune ligne de la forme « Terme : définition » ou « Question ? Réponse » ici. Essaie avec l'IA, ou ajoute les cartes à la main.", cards: [] };
  }
  if (!aiCardsAvailable()) return { error: "La génération par IA n'est pas encore activée sur Anima. Le repérage automatique, lui, marche déjà." };
  try {
    const cards = await generateCards(pdf ? { title, pdfBase64: pdf } : { title, text: text.slice(0, 120_000) });
    return cards.length ? { cards, via: "ia" } : { error: "L'IA n'a rien trouvé d'assez précis dans ce contenu.", cards: [] };
  } catch {
    return { error: "L'IA n'a pas pu répondre. Réessaie dans un instant." };
  }
}

const saveSchema = z.object({
  deckId: z.string().regex(/^[0-9a-f-]{36}$/i).nullable(),
  newDeck: z.string().trim().max(120).nullable(),
  subject: z.string().trim().max(80).nullable(),
  noteId: z.string().regex(/^[0-9a-f-]{36}$/i).nullable(),
  via: z.enum(["manuel", "ia", "auto"]),
  cards: z.array(draftCardSchema).min(1, "Garde au moins une carte.").max(200),
});

/** Enregistre les brouillons relus : ils entrent tout de suite en révision. */
export async function saveDrafts(input: z.input<typeof saveSchema>): Promise<{ error?: string; deckId?: string }> {
  const { supabase } = await requireUser();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Cartes invalides." };
  const { cards, noteId, via } = parsed.data;
  for (const c of cards) {
    const ok = cardSchema.safeParse(c);
    if (!ok.success) return { error: `« ${c.front.slice(0, 40)} » : ${ok.error.issues[0]?.message}` };
  }
  let deckId = parsed.data.deckId;
  if (!deckId) {
    const title = parsed.data.newDeck || "Nouveau paquet";
    const { data, error } = await supabase.from("decks").insert({ title, subject: parsed.data.subject || null }).select("id").single();
    if (error || !data) return { error: "Le paquet n'a pas pu être créé." };
    deckId = data.id;
  }
  const { error } = await supabase
    .from("cards")
    .insert(cards.map((c) => ({ deck_id: deckId!, kind: c.kind, front: c.front, back: c.back, note_id: noteId, source: via })));
  if (error) return { error: "Les cartes n'ont pas pu être enregistrées." };
  refresh(deckId);
  return { deckId };
}

/* Révision --------------------------------------------------------------- */

/**
 * Enregistre une réponse. La date suivante est recalculée ici à partir de
 * l'état en base (la source de vérité), avec le même algorithme que l'écran.
 */
export async function recordReview(scheduleId: string, rating: number, durationMs: number | null): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  const id = uuid(scheduleId);
  if (!id || ![1, 2, 3, 4].includes(rating)) return { error: "Réponse invalide." };
  const { data: s } = await supabase.from("card_schedules").select("*").eq("id", id).maybeSingle();
  if (!s) return { error: "Carte introuvable." };
  const { data: card } = await supabase.from("cards").select("deck_id").eq("id", s.card_id).maybeSingle();
  const w = reviewWrite(s, card?.deck_id ?? null, rating as Rating, { durationMs });
  const [u, l] = await Promise.all([
    supabase.from("card_schedules").update(w.update).eq("id", id),
    supabase.from("card_reviews").insert(w.log),
  ]);
  if (u.error || l.error) return { error: "La réponse n'a pas pu être enregistrée." };
  return {};
}

export async function finishSession() {
  revalidatePath("/flashcards", "layout");
}

/* Réglages --------------------------------------------------------------- */

export async function saveSettings(_: FlashState, form: FormData): Promise<FlashState> {
  const { supabase, user } = await requireUser();
  const parsed = settingsSchema.safeParse(fields(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Réglages invalides." };
  const { error } = await supabase
    .from("flashcard_settings")
    .upsert({ owner_id: user.id, ...parsed.data, updated_at: new Date().toISOString() } as never, { onConflict: "owner_id" });
  if (error) return { error: "Les réglages n'ont pas pu être enregistrés." };
  revalidatePath("/flashcards");
  return { ok: Date.now() };
}
