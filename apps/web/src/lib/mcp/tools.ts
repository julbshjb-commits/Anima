import "server-only";
import { z } from "zod";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import {
  AI_SPACE_META,
  WORK_STATUS,
  eventSchema,
  quoteSchema,
  taskSchema,
  textToDoc,
  todayIn,
  workSchema,
  zonedParts,
  zonedToIso,
  MOODS,
  type AiSpace,
} from "@anima/core";
import { tokenClient, type TokenClient } from "./auth";

/**
 * Outils du connecteur Anima. Chaque appel agit avec le jeton de la personne :
 * la base ne renvoie que ses données, et seulement dans les espaces ouverts
 * (politiques « ai_gate »). La vérification ci-dessous sert à répondre
 * clairement quand un espace est fermé.
 */

type Ctx = { sb: TokenClient; userId: string; spaces: AiSpace[] };
type Result = { content: { type: "text"; text: string }[]; isError?: boolean };

const ok = (text: string): Result => ({ content: [{ type: "text", text }] });
const fail = (text: string): Result => ({ content: [{ type: "text", text }], isError: true });
const json = (v: unknown) => ok(JSON.stringify(v, null, 2));

async function context(ctx: ServerContext): Promise<Ctx | null> {
  const auth = ctx.http?.authInfo;
  const userId = auth?.extra?.userId;
  if (!auth || typeof userId !== "string") return null;
  const sb = tokenClient(auth.token);
  const { data } = await sb.from("ai_access").select("spaces").eq("user_id", userId).maybeSingle();
  return { sb, userId, spaces: (data?.spaces ?? []) as AiSpace[] };
}

const closed = (space: AiSpace) =>
  fail(
    `L'espace « ${AI_SPACE_META[space].label} » n'est pas ouvert à cet assistant. La personne peut l'ouvrir dans Anima, Réglages, « Claude et les assistants IA ».`,
  );

/** Enveloppe commune : contexte, espace requis, erreurs lisibles. */
function tool<A>(space: AiSpace | null, run: (args: A, c: Ctx) => Promise<Result>) {
  return async (args: A, ctx: ServerContext): Promise<Result> => {
    const c = await context(ctx);
    if (!c) return fail("Connexion à Anima expirée. Reconnecte le connecteur.");
    if (space && !c.spaces.includes(space)) return closed(space);
    try {
      return await run(args, c);
    } catch {
      return fail("Anima n'a pas pu répondre. Réessaie dans un instant.");
    }
  };
}

const uuid = z.uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Date au format AAAA-MM-JJ (fuseau Europe/Paris).");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).describe("Heure HH:MM (Europe/Paris).");
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const clip = (s: string | null | undefined, n: number) => (s && s.length > n ? `${s.slice(0, n)}…` : (s ?? ""));

export function registerAnimaTools(server: McpServer) {
  server.registerTool(
    "anima_espaces",
    {
      title: "Espaces ouverts",
      description:
        "Indique quels espaces d'Anima la personne a ouverts à l'assistant, et la date du jour à Paris. À appeler en premier en cas de doute.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    tool(null, async (_a, c) =>
      json({
        aujourdhui: todayIn(),
        espaces_ouverts: c.spaces.map((s) => AI_SPACE_META[s].label),
        espaces_fermes: (Object.keys(AI_SPACE_META) as AiSpace[]).filter((s) => !c.spaces.includes(s)).map((s) => AI_SPACE_META[s].label),
      }),
    ),
  );

  // ---------- M'organiser ----------
  server.registerTool(
    "taches_lister",
    {
      title: "Lister les tâches",
      description: "Tâches de M'organiser. Filtre : aujourdhui (en retard compris), a_venir, sans_date, terminees.",
      inputSchema: z.object({ filtre: z.enum(["aujourdhui", "a_venir", "sans_date", "terminees"]).default("aujourdhui") }),
      annotations: { readOnlyHint: true },
    },
    tool("organiser", async ({ filtre }: { filtre: "aujourdhui" | "a_venir" | "sans_date" | "terminees" }, { sb }) => {
      const today = todayIn();
      let q = sb.from("tasks").select("id, title, due_date, due_time, note, done_at, project_id");
      if (filtre === "terminees") q = q.not("done_at", "is", null).order("done_at", { ascending: false }).limit(30);
      else {
        q = q.is("done_at", null);
        if (filtre === "aujourdhui") q = q.lte("due_date", today);
        if (filtre === "a_venir") q = q.gt("due_date", today);
        if (filtre === "sans_date") q = q.is("due_date", null);
        q = q.order("due_date", { ascending: true, nullsFirst: false }).order("due_time", { ascending: true, nullsFirst: false }).limit(100);
      }
      const { data, error } = await q;
      if (error) throw error;
      return json({ aujourdhui: today, taches: data });
    }),
  );

  server.registerTool(
    "tache_ajouter",
    {
      title: "Ajouter une tâche",
      description: "Ajoute une tâche dans M'organiser, avec un jour et une heure facultatifs.",
      inputSchema: z.object({ titre: z.string().min(1).max(200), jour: day.optional(), heure: time.optional(), note: z.string().max(2000).optional() }),
    },
    tool("organiser", async (a: { titre: string; jour?: string; heure?: string; note?: string }, { sb }) => {
      const t = taskSchema.safeParse({ title: a.titre, dueDate: a.jour ?? null, dueTime: a.heure ?? null, note: a.note ?? null });
      if (!t.success) return fail(t.error.issues[0]?.message ?? "Tâche invalide.");
      const { data, error } = await sb
        .from("tasks")
        .insert({ title: t.data.title, due_date: t.data.dueDate, due_time: t.data.dueTime, note: t.data.note })
        .select("id, title, due_date, due_time")
        .single();
      if (error) throw error;
      return json({ ajoutee: data });
    }),
  );

  server.registerTool(
    "tache_terminer",
    {
      title: "Cocher une tâche",
      description: "Marque une tâche comme faite (ou la rouvre avec fait=false).",
      inputSchema: z.object({ id: uuid, fait: z.boolean().default(true) }),
    },
    tool("organiser", async ({ id, fait }: { id: string; fait: boolean }, { sb }) => {
      const { data, error } = await sb.from("tasks").update({ done_at: fait ? new Date().toISOString() : null }).eq("id", id).select("id, title").maybeSingle();
      if (error) throw error;
      return data ? json({ tache: data, faite: fait }) : fail("Tâche introuvable.");
    }),
  );

  server.registerTool(
    "agenda_lister",
    {
      title: "Lire l'agenda",
      description: "Rendez-vous de l'agenda entre deux dates (par défaut, les 7 prochains jours).",
      inputSchema: z.object({ du: day.optional(), au: day.optional() }),
      annotations: { readOnlyHint: true },
    },
    tool("organiser", async (a: { du?: string; au?: string }, { sb }) => {
      const from = a.du ?? todayIn();
      const to = a.au ?? addDays(from, 7);
      const { data, error } = await sb
        .from("events")
        .select("id, title, place, starts_at, ends_at")
        .gte("starts_at", zonedToIso(from, "00:00"))
        .lt("starts_at", zonedToIso(addDays(to, 1), "00:00"))
        .order("starts_at")
        .limit(200);
      if (error) throw error;
      const rdv = (data ?? []).map((e) => {
        const s = zonedParts(e.starts_at);
        return { id: e.id, titre: e.title, lieu: e.place, jour: s.day, debut: s.time, fin: e.ends_at ? zonedParts(e.ends_at).time : null };
      });
      return json({ du: from, au: to, rendez_vous: rdv });
    }),
  );

  server.registerTool(
    "rendez_vous_ajouter",
    {
      title: "Ajouter un rendez-vous",
      description: "Ajoute un rendez-vous dans l'agenda de M'organiser.",
      inputSchema: z.object({ titre: z.string().min(1).max(120), jour: day, debut: time, fin: time.optional(), lieu: z.string().max(120).optional() }),
    },
    tool("organiser", async (a: { titre: string; jour: string; debut: string; fin?: string; lieu?: string }, { sb }) => {
      const e = eventSchema.safeParse({ title: a.titre, day: a.jour, start: a.debut, end: a.fin ?? null, place: a.lieu ?? "" });
      if (!e.success) return fail(e.error.issues[0]?.message ?? "Rendez-vous invalide.");
      const { data, error } = await sb
        .from("events")
        .insert({
          title: e.data.title,
          place: e.data.place,
          color: e.data.color,
          starts_at: zonedToIso(e.data.day, e.data.start),
          ends_at: e.data.end ? zonedToIso(e.data.day, e.data.end) : null,
        })
        .select("id, title")
        .single();
      if (error) throw error;
      return json({ ajoute: data, jour: e.data.day, debut: e.data.start });
    }),
  );

  // ---------- Notes ----------
  server.registerTool(
    "notes_chercher",
    {
      title: "Chercher dans les notes",
      description: "Cherche des notes par mots du titre ou du texte, ou par tag. Sans critère : les notes récentes.",
      inputSchema: z.object({ texte: z.string().max(100).optional(), tag: z.string().max(30).optional() }),
      annotations: { readOnlyHint: true },
    },
    tool("notes", async (a: { texte?: string; tag?: string }, { sb }) => {
      let q = sb.from("notes").select("id, notebook_id, title, body, tags, session_date, updated_at");
      const words = (a.texte ?? "").replace(/[%_,()*"\\:]/g, " ").trim();
      if (words) q = q.or(`title.ilike.%${words}%,body.ilike.%${words}%`);
      if (a.tag) q = q.contains("tags", [a.tag.replace(/^#/, "").toLowerCase()]);
      const [{ data, error }, books] = await Promise.all([
        q.order("updated_at", { ascending: false }).limit(25),
        sb.from("notebooks").select("id, title, kind"),
      ]);
      if (error) throw error;
      const name = new Map((books.data ?? []).map((b) => [b.id, b.title]));
      return json(
        (data ?? []).map((n) => ({ id: n.id, titre: n.title, carnet: name.get(n.notebook_id), tags: n.tags, extrait: clip(n.body, 200), modifiee: n.updated_at })),
      );
    }),
  );

  server.registerTool(
    "note_lire",
    {
      title: "Lire une note",
      description: "Texte complet d'une note (et, pour une séance de cours, les passages de chacun).",
      inputSchema: z.object({ id: uuid }),
      annotations: { readOnlyHint: true },
    },
    tool("notes", async ({ id }: { id: string }, { sb }) => {
      const { data: n, error } = await sb.from("notes").select("id, title, body, tags, session_date, notebook_id, updated_at").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!n) return fail("Note introuvable.");
      const { data: blocks } = await sb.from("note_blocks").select("kind, content, created_at").eq("note_id", id).order("created_at").limit(500);
      return json({ ...n, passages: blocks ?? [] });
    }),
  );

  server.registerTool(
    "note_creer",
    {
      title: "Créer une note",
      description: "Crée une note dans un carnet personnel (le premier carnet perso si aucun n'est donné).",
      inputSchema: z.object({ titre: z.string().min(1).max(120), texte: z.string().max(100000).default(""), tags: z.array(z.string().max(30)).max(20).optional(), carnet_id: uuid.optional() }),
    },
    tool("notes", async (a: { titre: string; texte: string; tags?: string[]; carnet_id?: string }, { sb, userId }) => {
      let notebookId = a.carnet_id;
      if (!notebookId) {
        const { data: book } = await sb.from("notebooks").select("id").eq("owner_id", userId).eq("kind", "perso").is("archived_at", null).order("created_at").limit(1).maybeSingle();
        notebookId = book?.id;
        if (!notebookId) {
          const { data: created, error } = await sb.from("notebooks").insert({ title: "Mes notes", kind: "perso" }).select("id").single();
          if (error) throw error;
          notebookId = created.id;
        }
      }
      const tags = [...new Set((a.tags ?? []).map((t) => t.replace(/^#/, "").toLowerCase().replace(/[^\p{L}\p{N}_-]/gu, "")).filter(Boolean))];
      const { data, error } = await sb.from("notes").insert({ notebook_id: notebookId, title: a.titre.trim(), body: a.texte, tags }).select("id, title, notebook_id").single();
      if (error) return fail("La note n'a pas pu être créée (carnet introuvable ou non modifiable).");
      return json({ creee: data });
    }),
  );

  server.registerTool(
    "note_completer",
    {
      title: "Compléter une note",
      description: "Ajoute du texte à la fin d'une note personnelle existante.",
      inputSchema: z.object({ id: uuid, texte: z.string().min(1).max(20000) }),
    },
    tool("notes", async ({ id, texte }: { id: string; texte: string }, { sb }) => {
      const { data: n } = await sb.from("notes").select("body").eq("id", id).maybeSingle();
      if (!n) return fail("Note introuvable.");
      const body = n.body ? `${n.body}\n\n${texte}` : texte;
      if (body.length > 100000) return fail("La note deviendrait trop longue.");
      const { data, error } = await sb.from("notes").update({ body }).eq("id", id).select("id, title").maybeSingle();
      if (error || !data) return fail("Cette note ne peut pas être modifiée.");
      return json({ completee: data });
    }),
  );

  // ---------- Bibliothèque ----------
  server.registerTool(
    "bibliotheque_lister",
    {
      title: "Lister la bibliothèque",
      description: "Œuvres de la bibliothèque (livres, films, séries, podcasts, articles), filtrées par statut.",
      inputSchema: z.object({ statut: z.enum(["a-lire", "en-cours", "termine"]).optional() }),
      annotations: { readOnlyHint: true },
    },
    tool("bibliotheque", async ({ statut }: { statut?: "a-lire" | "en-cours" | "termine" }, { sb }) => {
      let q = sb.from("works").select("id, kind, title, creator, status, progress, progress_total, rating, finished_on");
      if (statut) q = q.eq("status", statut);
      const { data, error } = await q.order("updated_at", { ascending: false }).limit(100);
      if (error) throw error;
      return json((data ?? []).map((w) => ({ ...w, statut: WORK_STATUS[w.status] })));
    }),
  );

  server.registerTool(
    "oeuvre_ajouter",
    {
      title: "Ajouter une œuvre",
      description: "Ajoute un livre, film, série, podcast ou article à la bibliothèque.",
      inputSchema: z.object({
        titre: z.string().min(1).max(200),
        auteur: z.string().max(120).optional(),
        type: z.enum(["livre", "film", "serie", "podcast", "article"]).default("livre"),
        statut: z.enum(["a-lire", "en-cours", "termine"]).default("a-lire"),
      }),
    },
    tool("bibliotheque", async (a: { titre: string; auteur?: string; type: "livre" | "film" | "serie" | "podcast" | "article"; statut: "a-lire" | "en-cours" | "termine" }, { sb }) => {
      const w = workSchema.safeParse({ title: a.titre, creator: a.auteur ?? null, kind: a.type, status: a.statut });
      if (!w.success) return fail(w.error.issues[0]?.message ?? "Œuvre invalide.");
      const { data, error } = await sb.from("works").insert(w.data).select("id, title, kind, status").single();
      if (error) throw error;
      return json({ ajoutee: data });
    }),
  );

  server.registerTool(
    "citation_ajouter",
    {
      title: "Garder une citation",
      description: "Garde une citation dans la bibliothèque, rattachée ou non à une œuvre.",
      inputSchema: z.object({ texte: z.string().min(1).max(2000), source: z.string().max(200).optional(), oeuvre_id: uuid.optional() }),
    },
    tool("bibliotheque", async (a: { texte: string; source?: string; oeuvre_id?: string }, { sb }) => {
      const qt = quoteSchema.safeParse({ text: a.texte, source: a.source ?? null });
      if (!qt.success) return fail(qt.error.issues[0]?.message ?? "Citation invalide.");
      const { data, error } = await sb.from("quotes").insert({ ...qt.data, work_id: a.oeuvre_id ?? null }).select("id").single();
      if (error) return fail("La citation n'a pas pu être gardée (œuvre introuvable ?).");
      return json({ gardee: data });
    }),
  );

  // ---------- Journaux (partagés et intime, chacun selon son autorisation) ----------
  server.registerTool(
    "journaux_lister",
    {
      title: "Lister les journaux",
      description: "Journaux accessibles : partagés si l'espace Journaux est ouvert, intime seulement s'il a été ouvert à part.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    tool(null, async (_a, { sb, spaces }) => {
      if (!spaces.includes("journaux") && !spaces.includes("intime")) return closed("journaux");
      const { data, error } = await sb.from("journals").select("id, title, kind").is("archived_at", null).order("updated_at", { ascending: false });
      if (error) throw error;
      return json(data);
    }),
  );

  server.registerTool(
    "journal_lire",
    {
      title: "Lire un journal",
      description: "Dernières entrées d'un journal (texte, date, humeur, auteur).",
      inputSchema: z.object({ journal_id: uuid, nombre: z.number().int().min(1).max(50).default(10) }),
      annotations: { readOnlyHint: true },
    },
    tool(null, async ({ journal_id, nombre }: { journal_id: string; nombre: number }, { sb }) => {
      const { data: j } = await sb.from("journals").select("id, title, kind").eq("id", journal_id).maybeSingle();
      if (!j) return fail("Journal introuvable ou non ouvert à l'assistant.");
      const { data, error } = await sb
        .from("journal_entries")
        .select("id, entry_date, title, content_text, mood, author_id")
        .eq("journal_id", journal_id)
        .is("deleted_at", null)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(nombre);
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((e) => e.author_id))];
      const { data: people } = ids.length ? await sb.from("profiles").select("id, display_name").in("id", ids) : { data: [] };
      const who = new Map((people ?? []).map((p) => [p.id, p.display_name]));
      return json({ journal: j, entrees: (data ?? []).map(({ author_id, ...e }) => ({ ...e, auteur: who.get(author_id) ?? "Un membre" })) });
    }),
  );

  server.registerTool(
    "entree_ecrire",
    {
      title: "Écrire une entrée",
      description: "Écrit une entrée dans un journal ouvert à l'assistant, au nom de la personne. Ne le faire que si elle le demande explicitement.",
      inputSchema: z.object({ journal_id: uuid, texte: z.string().min(1).max(50000), titre: z.string().max(120).optional(), humeur: z.enum(MOODS).optional(), jour: day.optional() }),
    },
    tool(null, async (a: { journal_id: string; texte: string; titre?: string; humeur?: (typeof MOODS)[number]; jour?: string }, { sb, userId }) => {
      const { data, error } = await sb
        .from("journal_entries")
        .insert({
          journal_id: a.journal_id,
          author_id: userId,
          entry_date: a.jour ?? todayIn(),
          title: a.titre?.trim() || null,
          content: textToDoc(a.texte.trim()),
          content_text: a.texte.trim(),
          mood: a.humeur ?? null,
        })
        .select("id, entry_date")
        .single();
      if (error) return fail("L'entrée n'a pas pu être écrite (journal fermé à l'assistant, ou en lecture seule).");
      return json({ ecrite: data });
    }),
  );

  // ---------- Cercles (lecture) ----------
  server.registerTool(
    "cercles_lire",
    {
      title: "Lire les cercles",
      description: "Dernières publications des cercles (mots, événements, citations).",
      inputSchema: z.object({ cercle_id: uuid.optional(), nombre: z.number().int().min(1).max(50).default(15) }),
      annotations: { readOnlyHint: true },
    },
    tool("cercles", async (a: { cercle_id?: string; nombre: number }, { sb }) => {
      let q = sb.from("circle_posts").select("id, circle_id, author_id, body, event_title, event_day, event_time, event_place, quote_text, quote_source, created_at");
      if (a.cercle_id) q = q.eq("circle_id", a.cercle_id);
      const [{ data, error }, circles] = await Promise.all([q.order("created_at", { ascending: false }).limit(a.nombre), sb.from("circles").select("id, name")]);
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((p) => p.author_id))];
      const { data: people } = ids.length ? await sb.from("profiles").select("id, display_name").in("id", ids) : { data: [] };
      const who = new Map((people ?? []).map((p) => [p.id, p.display_name]));
      const name = new Map((circles.data ?? []).map((c) => [c.id, c.name]));
      return json({
        cercles: circles.data ?? [],
        publications: (data ?? []).map(({ author_id, circle_id, ...p }) => ({ ...p, cercle: name.get(circle_id), auteur: who.get(author_id) ?? "Un membre" })),
      });
    }),
  );

  // ---------- Fichiers (noms seulement) ----------
  server.registerTool(
    "fichiers_lister",
    {
      title: "Lister les fichiers",
      description: "Noms, types et tailles des fichiers du disque Anima (hors corbeille). Le contenu des fichiers n'est pas lu.",
      inputSchema: z.object({ texte: z.string().max(100).optional() }),
      annotations: { readOnlyHint: true },
    },
    tool("fichiers", async ({ texte }: { texte?: string }, { sb, userId }) => {
      let q = sb.from("files").select("id, name, mime_type, size_bytes, folder_id, updated_at").eq("owner_id", userId).is("trashed_at", null);
      const words = (texte ?? "").replace(/[%_,()*"\\:]/g, " ").trim();
      if (words) q = q.ilike("name", `%${words}%`);
      const { data, error } = await q.order("updated_at", { ascending: false }).limit(100);
      if (error) throw error;
      return json(data);
    }),
  );
}
