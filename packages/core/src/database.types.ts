/**
 * Types de la base, écrits à la main d'après supabase/migrations.
 * Partagés par le web et le mobile. À régénérer un jour avec `supabase gen types typescript`.
 */
import type { JournalKind, JournalRole, Mood } from "./journaux";

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
        }
      >;
      events: Table<CalendarEvent, { title: string; place?: string | null; color?: Mood; starts_at: string; ends_at?: string | null }>;
      rituals: Table<Ritual, { title: string; archived_at?: string | null }>;
      ritual_checks: Table<RitualCheck, { ritual_id: string; day: string }>;
    };
    Views: Record<never, never>;
    Functions: {
      create_journal_invite: { Args: { p_journal_id: string }; Returns: { code: string; expires_at: string }[] };
      join_journal_with_code: { Args: { p_code: string }; Returns: string | null };
      revoke_journal_invite: { Args: { p_invite_id: string }; Returns: undefined };
      leave_journal: { Args: { p_journal_id: string }; Returns: undefined };
      prepare_account_deletion: { Args: Record<string, never>; Returns: undefined };
    };
    Enums: {
      journal_kind: JournalKind;
      journal_role: JournalRole;
      mood: Mood;
    };
    CompositeTypes: Record<never, never>;
  };
};
