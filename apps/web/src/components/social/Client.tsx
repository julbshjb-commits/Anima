"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MAX_SOCIAL_IMAGE_BYTES,
  MOODS,
  MOOD_META,
  REPORT_REASONS,
  SOCIAL_IMAGE_TYPES,
  compactCount,
  normalizeHandle,
  socialPath,
  type Mood,
} from "@anima/core";
import { browserClient } from "@/lib/supabase/browser";
import { btn, btnGhost, input } from "@/components/ui";
import { IconCoeur, IconGuillemets, IconPhoto, IconPoints } from "@/components/icons";
import {
  addComment,
  block,
  createPost,
  deletePost,
  leaveNetwork,
  report,
  saveProfile,
  toggleLike,
  type SocialState,
} from "@/app/(app)/(menu)/decouvrir/actions";
import { ProfilePic } from "./ProfilePic";

function Err({ state }: { state: SocialState }) {
  return state.error ? (
    <p role="alert" className="text-sm text-terre">
      {state.error}
    </p>
  ) : null;
}

async function uploadImage(userId: string, kind: "avatar" | "post", file: File): Promise<{ path: string } | { error: string }> {
  if (!(SOCIAL_IMAGE_TYPES as readonly string[]).includes(file.type)) return { error: "Choisis une photo JPEG, PNG ou WebP." };
  if (file.size > MAX_SOCIAL_IMAGE_BYTES) return { error: "La photo dépasse 10 Mo." };
  const supabase = browserClient();
  if (!supabase) return { error: "Le stockage n'est pas encore relié." };
  const path = socialPath(userId, kind, file.type, crypto.randomUUID());
  const { error } = await supabase.storage.from("social").upload(path, file, { contentType: file.type });
  if (error) return { error: "La photo n'a pas pu être envoyée." };
  return { path };
}

/* ------------------------------------------------------------------ */
/* J'aime                                                              */
/* ------------------------------------------------------------------ */

export function LikeButton({ postId, liked, count }: { postId: string; liked: boolean; count: number }) {
  const [state, setState] = useState({ liked, count });
  const [burst, setBurst] = useState(0);
  const [, start] = useTransition();
  const click = () => {
    const next = !state.liked;
    setState((s) => ({ liked: next, count: s.count + (next ? 1 : -1) }));
    if (next) setBurst((b) => b + 1);
    start(async () => {
      const r = await toggleLike(postId, next);
      if (!r.ok) setState((s) => ({ liked: !next, count: s.count + (next ? -1 : 1) }));
    });
  };
  return (
    <button
      type="button"
      onClick={click}
      aria-pressed={state.liked}
      aria-label={state.liked ? "Je n'aime plus" : "J'aime"}
      className={`relative inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-sm transition-colors active:scale-90 ${state.liked ? "text-champagne" : "text-doux hover:text-noir hover:bg-lin"}`}
    >
      <span key={burst} className={`relative grid place-items-center ${burst ? "animate-pop" : ""}`}>
        <IconCoeur filled={state.liked} size={19} />
        {burst > 0 && state.liked && <span aria-hidden className="eclat" />}
      </span>
      {state.count > 0 && <span className="tabular-nums">{compactCount(state.count)}</span>}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Menu « ⋯ » d'une publication ou d'un profil                         */
/* ------------------------------------------------------------------ */

export function ContentMenu({
  kind,
  targetId,
  authorId,
  authorHandle,
  mine,
  back = false,
}: {
  kind: "post" | "comment" | "profile";
  targetId: string;
  authorId: string;
  authorHandle: string;
  mine: boolean;
  back?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const item = "w-full text-left px-4 h-11 text-sm hover:bg-lin rounded-xl";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Plus d'options"
        aria-expanded={open}
        className="w-9 h-9 grid place-items-center rounded-full text-doux hover:text-noir hover:bg-lin"
      >
        <IconPoints />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-30 w-60 p-1.5 rounded-2xl bg-[rgba(24,24,26,.97)] backdrop-blur-xl border border-trait shadow-[0_24px_60px_-20px_rgba(0,0,0,.9)] animate-pop origin-top-right">
          {mine && kind === "post" ? (
            <form action={deletePost}>
              <input type="hidden" name="id" value={targetId} />
              {back && <input type="hidden" name="back" value="1" />}
              <button className={`${item} text-terre`} onClick={(e) => !confirm("Supprimer cette publication ?") && e.preventDefault()}>
                Supprimer la publication
              </button>
            </form>
          ) : (
            <>
              <button type="button" className={item} onClick={() => (setReporting(true), setOpen(false))}>
                Signaler
              </button>
              {!mine && (
                <form action={block}>
                  <input type="hidden" name="id" value={authorId} />
                  <button className={`${item} text-terre`} onClick={(e) => !confirm(`Bloquer @${authorHandle} ? Vous ne verrez plus rien l'un de l'autre.`) && e.preventDefault()}>
                    Bloquer @{authorHandle}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      )}
      {reporting && <ReportDialog kind={kind} targetId={targetId} authorId={authorId} authorHandle={authorHandle} onClose={() => setReporting(false)} />}
    </div>
  );
}

function ReportDialog({
  kind,
  targetId,
  authorId,
  authorHandle,
  onClose,
}: {
  kind: "post" | "comment" | "profile";
  targetId: string;
  authorId: string;
  authorHandle: string;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(report, {});
  return (
    <div role="dialog" aria-modal aria-label="Signaler" className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-[28px] bg-[#161618] border border-trait p-6 flex flex-col gap-4 animate-pop" onClick={(e) => e.stopPropagation()}>
        {state.ok ? (
          <>
            <h2 className="titre text-2xl">Merci, c&apos;est noté.</h2>
            <p className="text-sm text-doux leading-relaxed">
              L&apos;équipe Anima va regarder. Si plusieurs personnes signalent le même contenu, il est masqué tout de suite en attendant.
            </p>
            <button type="button" className={btn} onClick={onClose}>
              Fermer
            </button>
          </>
        ) : (
          <form action={action} className="flex flex-col gap-4">
            <h2 className="titre text-2xl">Pourquoi signaler ?</h2>
            <input type="hidden" name="targetKind" value={kind} />
            <input type="hidden" name="targetId" value={targetId} />
            <input type="hidden" name="authorId" value={authorId} />
            <div className="flex flex-col gap-1.5">
              {Object.entries(REPORT_REASONS).map(([k, label]) => (
                <label key={k} className="flex items-center gap-3 h-11 px-4 rounded-2xl bg-lin has-[:checked]:bg-papier has-[:checked]:ring-1 has-[:checked]:ring-champagne/60 cursor-pointer text-sm">
                  <input type="radio" name="reason" value={k} required className="accent-[#e6c891]" />
                  {label}
                </label>
              ))}
            </div>
            <textarea name="details" maxLength={500} rows={2} placeholder="Un détail pour nous aider (facultatif)" className={`${input} h-auto py-3 resize-none`} />
            <label className="flex items-center gap-2 text-sm text-encre">
              <input type="checkbox" name="alsoBlock" className="accent-[#e6c891]" /> Bloquer aussi @{authorHandle}
            </label>
            <Err state={state} />
            <div className="flex gap-2 justify-end">
              <button type="button" className={btnGhost} onClick={onClose}>
                Annuler
              </button>
              <button className={btn} disabled={pending}>
                Envoyer
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Composer                                                            */
/* ------------------------------------------------------------------ */

export function Composer({
  userId,
  me,
  initial,
}: {
  userId: string;
  me: { name: string; handle: string; avatar: string | null };
  initial?: { body: string; mood: Mood | null; source: "journal" | "note"; label: string };
}) {
  const [quote, setQuote] = useState(false);
  const [mood, setMood] = useState<Mood | null>(initial?.mood ?? null);
  const [photo, setPhoto] = useState<{ path: string; preview: string } | null>(null);
  const [upErr, setUpErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [len, setLen] = useState(initial?.body.length ?? 0);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [state, action, pending] = useActionState(async (prev: SocialState, form: FormData) => {
    const r = await createPost(prev, form);
    if (r.ok) {
      ref.current?.reset();
      setPhoto(null);
      setMood(null);
      setQuote(false);
      setLen(0);
      router.refresh();
    }
    return r;
  }, {});

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setUpErr(null);
    setUploading(true);
    const r = await uploadImage(userId, "post", file);
    setUploading(false);
    if ("error" in r) return setUpErr(r.error);
    setPhoto({ path: r.path, preview: URL.createObjectURL(file) });
  };

  return (
    <form ref={ref} action={action} className="rounded-[28px] bg-papier border border-trait p-4 sm:p-5 flex gap-3.5">
      <ProfilePic name={me.name} handle={me.handle} src={me.avatar} size={44} />
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        {initial && (
          <p className="text-xs text-doux">
            Depuis {initial.label}. Relis et ajuste avant de publier : ce texte sera visible de tous.
          </p>
        )}
        <input type="hidden" name="source" value={quote ? "citation" : (initial?.source ?? "libre")} />
        <input type="hidden" name="mood" value={mood ?? ""} />
        <input type="hidden" name="photoPath" value={photo?.path ?? ""} />
        {initial && <input type="hidden" name="from" value="journal" />}
        <textarea
          name="body"
          maxLength={2000}
          defaultValue={initial?.body}
          onChange={(e) => setLen(e.target.value.length)}
          aria-label="Ta publication"
          placeholder={quote ? "La citation qui t'a marqué…" : "Qu'as-tu envie de partager aujourd'hui ?"}
          className={`w-full [field-sizing:content] min-h-14 max-h-[50vh] resize-none bg-transparent leading-[1.55] focus:outline-none placeholder:text-doux ${quote ? "titre italic text-[22px]" : "text-[17px]"}`}
        />
        {quote && <input name="quoteBy" maxLength={120} placeholder="De qui ? (auteur, livre, film…)" className={`${input} h-10 text-sm`} />}
        {photo && (
          <div className="relative self-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.preview} alt="" className="max-h-72 rounded-2xl border border-trait" />
            <button
              type="button"
              onClick={() => {
                browserClient()?.storage.from("social").remove([photo.path]);
                setPhoto(null);
              }}
              className="absolute top-2 right-2 h-8 px-3 rounded-full bg-black/70 text-xs text-blanc"
            >
              Retirer
            </button>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Humeur (facultatif)">
          {MOODS.slice(0, 5).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mood === m}
              onClick={() => setMood(mood === m ? null : m)}
              className={`h-8 px-3 rounded-full text-xs border transition-colors ${mood === m ? "border-transparent text-nuit" : "border-trait text-doux hover:text-noir"}`}
              style={mood === m ? { background: MOOD_META[m].color } : undefined}
            >
              {MOOD_META[m].label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 pt-1 border-t border-trait">
          <label className="w-10 h-10 grid place-items-center rounded-full text-doux hover:text-champagne hover:bg-lin cursor-pointer" aria-label="Ajouter une photo">
            <IconPhoto />
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          <button
            type="button"
            aria-pressed={quote}
            onClick={() => setQuote((q) => !q)}
            aria-label="Partager une citation"
            className={`w-10 h-10 grid place-items-center rounded-full hover:bg-lin ${quote ? "text-champagne" : "text-doux hover:text-champagne"}`}
          >
            <IconGuillemets />
          </button>
          {uploading && <span className="text-xs text-doux">Envoi de la photo…</span>}
          <span className={`ml-auto text-xs tabular-nums ${len > 1800 ? "text-terre" : "text-doux"}`}>{len > 0 ? `${len} / 2000` : ""}</span>
          <button className={`${btn} h-10 ml-2`} disabled={pending || uploading}>
            Publier
          </button>
        </div>
        {upErr && <p className="text-sm text-terre">{upErr}</p>}
        <Err state={state} />
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Commentaire                                                         */
/* ------------------------------------------------------------------ */

export function CommentForm({ postId, me }: { postId: string; me: { name: string; handle: string; avatar: string | null } }) {
  const [state, action, pending] = useActionState(addComment, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok]);
  return (
    <form ref={ref} action={action} className="flex items-start gap-3">
      <ProfilePic name={me.name} handle={me.handle} src={me.avatar} size={36} />
      <input type="hidden" name="postId" value={postId} />
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="flex gap-2">
          <input name="body" maxLength={500} required placeholder="Écris un commentaire bienveillant…" className={`${input} h-11`} />
          <button className={`${btn} h-11`} disabled={pending}>
            Envoyer
          </button>
        </div>
        <Err state={state} />
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Profil public                                                       */
/* ------------------------------------------------------------------ */

export function ProfileForm({
  userId,
  initial,
  suggested,
}: {
  userId: string;
  initial: { handle: string; name: string; bio: string; is_private: boolean; avatar: string | null } | null;
  suggested: { handle: string; name: string };
}) {
  const [state, action, pending] = useActionState(saveProfile, {});
  const [handle, setHandle] = useState(initial?.handle ?? suggested.handle);
  const [name, setName] = useState(initial?.name ?? suggested.name);
  const [avatar, setAvatar] = useState<{ path: string | null; preview: string | null; removed: boolean }>({ path: null, preview: initial?.avatar ?? null, removed: false });
  const [upErr, setUpErr] = useState<string | null>(null);
  const [free, setFree] = useState<boolean | null>(null);
  const [bioLen, setBioLen] = useState(initial?.bio.length ?? 0);

  useEffect(() => {
    const h = normalizeHandle(handle);
    if (h.length < 3 || h === initial?.handle) return;
    const t = setTimeout(async () => {
      const r = await browserClient()?.rpc("handle_available", { p_handle: h });
      setFree(r?.data ?? null);
    }, 350);
    return () => clearTimeout(t);
  }, [handle, initial?.handle]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setUpErr(null);
    if (!initial) {
      // Le profil n'existe pas encore : la photo s'ajoute après la création.
      setUpErr("Tu pourras ajouter ta photo juste après avoir créé ton profil.");
      return;
    }
    const r = await uploadImage(userId, "avatar", file);
    if ("error" in r) return setUpErr(r.error);
    setAvatar({ path: r.path, preview: URL.createObjectURL(file), removed: false });
  };

  const h = normalizeHandle(handle);
  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="avatarPath" value={avatar.path ?? ""} />
      {avatar.removed && <input type="hidden" name="removeAvatar" value="1" />}
      <div className="flex items-center gap-5">
        <ProfilePic name={name || "?"} handle={h || "x"} src={avatar.preview} size={88} ring />
        <div className="flex flex-col gap-2">
          <label className={`${btnGhost} h-10 cursor-pointer`}>
            {avatar.preview ? "Changer la photo" : "Ajouter une photo"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          {avatar.preview && (
            <button type="button" className="text-xs text-doux underline underline-offset-4 self-start" onClick={() => setAvatar({ path: null, preview: null, removed: true })}>
              Retirer la photo
            </button>
          )}
          {upErr && <p className="text-xs text-terre">{upErr}</p>}
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Nom affiché</span>
        <input name="name" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} className={input} />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Pseudo</span>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-doux">@</span>
          <input
            name="handle"
            required
            maxLength={30}
            value={handle}
            onChange={(e) => (setHandle(e.target.value), setFree(null))}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={`${input} pl-9`}
          />
        </div>
        <span className="text-xs text-doux">
          {h.length < 3
            ? "3 caractères minimum : lettres, chiffres, point et _."
            : h === initial?.handle
              ? `anima.app/@${h}`
              : free === true
                ? <span className="text-sauge">@{h} est libre ✓</span>
                : free === false
                  ? <span className="text-terre">@{h} est déjà pris ou réservé.</span>
                  : `@${h}`}
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium flex justify-between">
          Bio <span className="text-xs text-doux font-normal tabular-nums">{bioLen} / 160</span>
        </span>
        <textarea
          name="bio"
          maxLength={160}
          rows={3}
          defaultValue={initial?.bio}
          onChange={(e) => setBioLen(e.target.value.length)}
          placeholder="Ce qui t'anime en quelques mots…"
          className={`${input} h-auto py-3 resize-none`}
        />
      </label>

      <label className="flex items-start gap-3 p-4 rounded-2xl bg-lin cursor-pointer">
        <input type="checkbox" name="isPrivate" defaultChecked={initial?.is_private} className="mt-1 accent-[#e6c891]" />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">Compte privé</span>
          <span className="text-xs text-doux leading-relaxed">Tu choisis qui te suit. Seules les personnes que tu acceptes voient tes publications.</span>
        </span>
      </label>

      {!initial && (
        <div className="flex flex-col gap-2.5">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="age" required className="mt-1 accent-[#e6c891]" />
            <span>J&apos;ai 15 ans ou plus.</span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="rules" required className="mt-1 accent-[#e6c891]" />
            <span>
              J&apos;accepte les{" "}
              <Link href="/regles" className="underline underline-offset-4" target="_blank">
                règles de la communauté
              </Link>{" "}
              : bienveillance, pas de haine ni de harcèlement.
            </span>
          </label>
        </div>
      )}

      <Err state={state} />
      {state.ok && <p className="text-sm text-sauge">Ton profil est à jour.</p>}
      <div>
        <button className={btn} disabled={pending}>
          {initial ? "Enregistrer" : "Créer mon profil public"}
        </button>
      </div>
    </form>
  );
}

export function LeaveNetworkForm() {
  const [state, action, pending] = useActionState(leaveNetwork, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <p className="text-sm text-doux leading-relaxed">
        Ton profil public, tes publications, tes commentaires et tes abonnés sont effacés. Tes journaux, notes et cercles ne bougent pas.
      </p>
      <div className="flex flex-wrap gap-2">
        <input name="confirm" placeholder="Écris QUITTER" className={`${input} h-11 max-w-56`} />
        <button className={`${btnGhost} h-11 text-terre`} disabled={pending}>
          Quitter le réseau
        </button>
      </div>
      <Err state={state} />
    </form>
  );
}
