/**
 * Types de la base, écrits à la main d'après supabase/migrations.
 * Partagés par le web et le mobile. À régénérer un jour avec `supabase gen types typescript`.
 */
import type { JournalKind, JournalRole, Mood } from "./journaux";
import type { CardKind, CardState } from "./flashcards";

type Timestamp = string;

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Profile = {
  id: string;
  display_name: string;
  avatar_path: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type Journal = {
  id: string;
  owner_id: string;
  title: string;
  kind: JournalKind;
  cover: string;
  created_at: Timestamp;
  updated_at: Timestamp;
  archived_at: Timestamp | null;
};

export type JournalMember = {
  journal_id: string;
  user_id: string;
  role: JournalRole;
  joined_at: Timestamp;
};

export type JournalEntry = {
  id: string;
  journal_id: string;
  author_id: string;
  entry_date: string;
  title: string | null;
  content: Record<string, unknown>;
  content_text: string;
  mood: Mood | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted_at: Timestamp | null;
};

export type Attachment = {
  id: string;
  owner_id: string;
  journal_id: string;
  entry_id: string | null;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: Timestamp;
};

export type JournalInvite = {
  id: string;
  journal_id: string;
  created_by: string;
  code_hash: string;
  role: JournalRole;
  expires_at: Timestamp;
  max_uses: number;
  uses: number;
  revoked_at: Timestamp | null;
  created_at: Timestamp;
};

export type Project = {
  id: string;
  owner_id: string;
  title: string;
  color: Mood;
  created_at: Timestamp;
  updated_at: Timestamp;
  archived_at: Timestamp | null;
};

export type Task = {
  id: string;
  owner_id: string;
  project_id: string | null;
  title: string;
  note: string | null;
  due_date: string | null;
  due_time: string | null;
  duration_min: number | null;
  done_at: Timestamp | null;
  note_id: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type CalendarEvent = {
  id: string;
  owner_id: string;
  title: string;
  place: string | null;
  color: Mood;
  starts_at: Timestamp;
  ends_at: Timestamp | null;
  circle_post_id: string | null;
  done_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type Ritual = {
  id: string;
  owner_id: string;
  title: string;
  created_at: Timestamp;
  archived_at: Timestamp | null;
};

export type RitualCheck = { ritual_id: string; owner_id: string; day: string };

export type NotebookKind = "perso" | "cours";

export type Notebook = {
  id: string;
  owner_id: string;
  kind: NotebookKind;
  title: string;
  subtitle: string | null;
  cover: string;
  created_at: Timestamp;
  updated_at: Timestamp;
  archived_at: Timestamp | null;
};

export type NotebookMember = { notebook_id: string; user_id: string; role: "owner" | "editor"; joined_at: Timestamp };

export type Note = {
  id: string;
  notebook_id: string;
  author_id: string | null;
  title: string;
  body: string;
  tags: string[];
  session_date: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type NoteBlockKind = "texte" | "question";

export type NoteBlock = {
  id: string;
  note_id: string;
  notebook_id: string;
  author_id: string;
  kind: NoteBlockKind;
  content: string;
  done_at: Timestamp | null;
  file_id: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type Circle = {
  id: string;
  owner_id: string;
  name: string;
  color: Mood;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type CircleMember = { circle_id: string; user_id: string; role: "owner" | "member"; joined_at: Timestamp; last_seen_at: Timestamp };

export type CirclePost = {
  id: string;
  circle_id: string;
  author_id: string;
  body: string;
  event_title: string | null;
  event_day: string | null;
  event_end_day: string | null;
  event_time: string | null;
  event_place: string | null;
  quote_text: string | null;
  quote_source: string | null;
  file_id: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type CircleReaction = { post_id: string; circle_id: string; user_id: string; kind: "coeur" | "jensuis"; created_at: Timestamp };
export type CircleComment = { id: string; post_id: string; circle_id: string; author_id: string; body: string; created_at: Timestamp };

export type WorkKind = "livre" | "film" | "serie" | "podcast" | "article";
export type WorkStatus = "a-lire" | "en-cours" | "termine";

export type Work = {
  id: string;
  owner_id: string;
  kind: WorkKind;
  title: string;
  creator: string | null;
  cover: string;
  status: WorkStatus;
  progress: number | null;
  progress_total: number | null;
  rating: number | null;
  started_on: string | null;
  finished_on: string | null;
  url: string | null;
  note: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type Quote = { id: string; owner_id: string; work_id: string | null; text: string; source: string | null; created_at: Timestamp };
export type ReadingGoal = { owner_id: string; year: number; target: number };

export type Folder = { id: string; owner_id: string; parent_id: string | null; name: string; created_at: Timestamp; updated_at: Timestamp };

export type FileRow = {
  id: string;
  owner_id: string;
  folder_id: string | null;
  name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  starred: boolean;
  note_id: string | null;
  trashed_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type AiAccess = { user_id: string; spaces: string[]; updated_at: Timestamp };

export type Deck = {
  id: string;
  owner_id: string;
  title: string;
  subject: string | null;
  description: string | null;
  cover: string;
  notebook_id: string | null;
  project_id: string | null;
  /** Code à 8 caractères quand le paquet est partagé avec la promo. */
  share_code: string | null;
  /** Paquet d'origine quand c'est une copie ajoutée avec un code. */
  source_deck_id: string | null;
  /** Date de l'examen, pour le compte à rebours. */
  exam_date: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type DeckPreview = {
  title: string;
  subject: string | null;
  description: string | null;
  cover: string;
  author: string;
  cards: number;
  sample: { kind: CardKind; front: string; back: string }[];
  mine: boolean;
  /** La personne a déjà sa copie de ce paquet. */
  copied: boolean;
};

export type Card = {
  id: string;
  owner_id: string;
  deck_id: string;
  kind: CardKind;
  front: string;
  back: string;
  tags: string[];
  note_id: string | null;
  origin_card_id: string | null;
  source: "manuel" | "ia" | "auto";
  status: "active" | "a-verifier";
  suspended: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type CardSchedule = {
  id: string;
  owner_id: string;
  card_id: string;
  variant: number;
  state: CardState;
  step: number;
  due_at: Timestamp;
  interval_days: number;
  ease: number;
  reps: number;
  lapses: number;
  last_reviewed_at: Timestamp | null;
};

export type CardReview = {
  id: string;
  owner_id: string;
  schedule_id: string | null;
  deck_id: string | null;
  rating: number;
  state_before: CardState;
  interval_before: number;
  interval_after: number;
  duration_ms: number | null;
  reviewed_at: Timestamp;
};

export type FlashcardSettings = {
  owner_id: string;
  new_per_day: number;
  reviews_per_day: number;
  daily_goal: number;
  updated_at: Timestamp;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile, { id: string; display_name: string; avatar_path?: string | null }>;
      journals: Table<Journal, { owner_id: string; title: string; kind: JournalKind; cover?: string; archived_at?: string | null }>;
      journal_members: Table<JournalMember, { journal_id: string; user_id: string; role?: JournalRole }>;
      journal_entries: Table<
        JournalEntry,
        {
          journal_id: string;
          author_id: string;
          entry_date?: string;
          title?: string | null;
          content?: Record<string, unknown>;
          content_text?: string;
          mood?: Mood | null;
          deleted_at?: string | null;
        }
      >;
      entry_reads: Table<{ entry_id: string; user_id: string; read_at: Timestamp }, { entry_id: string; user_id: string }>;
      attachments: Table<
        Attachment,
        { owner_id: string; journal_id: string; entry_id?: string | null; storage_path: string; mime_type: string; size_bytes: number }
      >;
      journal_invites: Table<JournalInvite, never>;
      projects: Table<Project, { title: string; color?: Mood; archived_at?: string | null }>;
      tasks: Table<
        Task,
        {
          title: string;
          project_id?: string | null;
          note?: string | null;
          due_date?: string | null;
          due_time?: string | null;
          duration_min?: number | null;
          done_at?: string | null;
          note_id?: string | null;
        }
      >;
      events: Table<CalendarEvent, { title: string; place?: string | null; color?: Mood; starts_at: string; ends_at?: string | null; circle_post_id?: string | null; done_at?: string | null }>;
      rituals: Table<Ritual, { title: string; archived_at?: string | null }>;
      ritual_checks: Table<RitualCheck, { ritual_id: string; day: string }>;
      notebooks: Table<Notebook, { title: string; kind?: NotebookKind; subtitle?: string | null; cover?: string; archived_at?: string | null }>;
      notebook_members: Table<NotebookMember, never>;
      notes: Table<Note, { notebook_id: string; title: string; body?: string; tags?: string[]; session_date?: string | null }>;
      /** notebook_id est recopié de la note par la base ; on l'envoie quand même. */
      note_blocks: Table<NoteBlock, { note_id: string; notebook_id: string; kind?: NoteBlockKind; content: string; file_id?: string | null }>;
      circles: Table<Circle, { name: string; color?: Mood }>;
      circle_members: Table<CircleMember, never>;
      circle_posts: Table<
        CirclePost,
        {
          circle_id: string;
          body?: string;
          event_title?: string | null;
          event_day?: string | null;
          event_end_day?: string | null;
          event_time?: string | null;
          event_place?: string | null;
          quote_text?: string | null;
          quote_source?: string | null;
          file_id?: string | null;
        }
      >;
      /** circle_id est recopié de la publication par la base ; on l'envoie quand même. */
      circle_reactions: Table<CircleReaction, { post_id: string; circle_id: string; kind: "coeur" | "jensuis" }>;
      circle_comments: Table<CircleComment, { post_id: string; circle_id: string; body: string }>;
      circle_invites: Table<{ id: string; circle_id: string; expires_at: Timestamp; revoked_at: Timestamp | null }, never>;
      works: Table<Work, Partial<Omit<Work, "id" | "owner_id" | "created_at" | "updated_at">> & { title: string }>;
      quotes: Table<Quote, { work_id?: string | null; text: string; source?: string | null }>;
      folders: Table<Folder, { name: string; parent_id?: string | null }>;
      /** Taille et type sont lus depuis le stockage par la base. */
      ai_access: Table<AiAccess, { spaces: string[]; updated_at?: string }>;
      files: Table<FileRow, { name: string; storage_path: string; folder_id?: string | null; starred?: boolean; note_id?: string | null; trashed_at?: string | null }>;
      reading_goals: Table<ReadingGoal, { year: number; target: number }>;
      notebook_invites: Table<{ id: string; notebook_id: string; expires_at: Timestamp; revoked_at: Timestamp | null }, never>;
      decks: Table<Deck, { title: string; subject?: string | null; description?: string | null; cover?: string; notebook_id?: string | null; project_id?: string | null; exam_date?: string | null }>;
      cards: Table<Card, { deck_id: string; front: string; kind?: CardKind; back?: string; tags?: string[]; note_id?: string | null; source?: Card["source"]; status?: Card["status"]; suspended?: boolean }>;
      /** Les lignes sont créées par la base quand une carte est ajoutée. */
      card_schedules: Table<CardSchedule, never, Partial<Omit<CardSchedule, "id" | "owner_id" | "card_id" | "variant">>>;
      card_reviews: Table<CardReview, { schedule_id: string | null; deck_id: string | null; rating: number; state_before: CardState; interval_before?: number; interval_after?: number; duration_ms?: number | null; reviewed_at?: string }>;
      flashcard_settings: Table<FlashcardSettings, { new_per_day?: number; reviews_per_day?: number; daily_goal?: number; updated_at?: string }>;
    };
    Views: Record<never, never>;
    Functions: {
      create_journal_invite: { Args: { p_journal_id: string }; Returns: { code: string; expires_at: string }[] };
      join_journal_with_code: { Args: { p_code: string }; Returns: string | null };
      revoke_journal_invite: { Args: { p_invite_id: string }; Returns: undefined };
      leave_journal: { Args: { p_journal_id: string }; Returns: undefined };
      prepare_account_deletion: { Args: Record<string, never>; Returns: undefined };
      create_notebook_invite: { Args: { p_notebook_id: string }; Returns: { code: string; expires_at: string }[] };
      join_with_code: { Args: { p_code: string }; Returns: { type: "journal" | "carnet" | "cercle"; id: string } | null };
      create_circle_invite: { Args: { p_circle_id: string }; Returns: { code: string; expires_at: string }[] };
      leave_circle: { Args: { p_circle_id: string }; Returns: undefined };
      mark_circles_seen: { Args: { p_circle_id?: string | null }; Returns: undefined };
      leave_notebook: { Args: { p_notebook_id: string }; Returns: undefined };
      toggle_question: { Args: { p_block_id: string }; Returns: undefined };
      storage_used_bytes: { Args: Record<string, never>; Returns: number };
      file_quota_bytes: { Args: Record<string, never>; Returns: number };
      deck_share: { Args: { p_deck_id: string; p_on: boolean }; Returns: string | null };
      deck_preview: { Args: { p_code: string }; Returns: DeckPreview | null };
      deck_import: { Args: { p_code: string }; Returns: string | null };
      deck_updates: { Args: { p_deck_id: string }; Returns: number };
      deck_pull: { Args: { p_deck_id: string }; Returns: number };
    };
    Enums: {
      journal_kind: JournalKind;
      journal_role: JournalRole;
      mood: Mood;
      notebook_kind: NotebookKind;
    };
    CompositeTypes: Record<never, never>;
  };
};
