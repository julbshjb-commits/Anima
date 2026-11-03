import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { fileType, formatBytes, isImage } from "@anima/core";
import {
  VUES,
  getDrive,
  getFileDetail,
  signFiles,
  type Drive,
  type FileDetail,
  type FileItem,
  type Vue,
} from "@/lib/fichiers";
import { relativeTime } from "@/lib/format";
import {
  IconCadenas,
  IconCorbeille,
  IconDossier,
  IconEtoile,
  IconGrille,
  IconHorloge,
  IconListe,
  IconPartages,
  IconRetour,
} from "@/components/icons";
import {
  deleteForever,
  emptyTrash,
  restoreFile,
  toggleStar,
  trashFile,
} from "./actions";
import {
  DeleteFolder,
  Importer,
  LinkNote,
  Move,
  NewFolder,
  Rename,
  ShareToCircle,
} from "./Forms";

export const metadata: Metadata = { title: "Mes fichiers" };

export default function FichiersPage(props: PageProps<"/fichiers">) {
  return (
    <Suspense fallback={<p className="p-10 text-doux">Chargement…</p>}>
      <Fichiers {...props} />
    </Suspense>
  );
}

const LABELS: Record<Vue, string> = {
  disque: "Mon disque",
  partages: "Partagés avec moi",
  recents: "Récents",
  favoris: "Favoris",
  corbeille: "Corbeille",
};
const ICONS = {
  disque: IconDossier,
  partages: IconPartages,
  recents: IconHorloge,
  favoris: IconEtoile,
  corbeille: IconCorbeille,
};

type Params = { vue: Vue; dossier: string | null; grille: boolean };
const uuid = (v: unknown) =>
  typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null;

/** Lien vers la même page avec quelques paramètres changés. */
function href(p: Params, change: Partial<Params & { f: string | null }> = {}) {
  const n = { ...p, f: null as string | null, ...change };
  const q = new URLSearchParams();
  if (n.vue !== "disque") q.set("vue", n.vue);
  if (n.dossier && n.vue === "disque") q.set("dossier", n.dossier);
  if (n.grille) q.set("affichage", "grille");
  if (n.f) q.set("f", n.f);
  const s = q.toString();
  return s ? `/fichiers?${s}` : "/fichiers";
}

async function Fichiers({ searchParams }: PageProps<"/fichiers">) {
  const sp = await searchParams;
  const vue = VUES.includes(sp.vue as Vue) ? (sp.vue as Vue) : "disque";
  const p: Params = {
    vue,
    dossier: vue === "disque" ? uuid(sp.dossier) : null,
    grille: sp.affichage === "grille",
  };
  const drive = await getDrive(vue, p.dossier);
  if (!drive) {
    return (
      <main className="p-10 flex flex-col gap-3">
        <p>Ce dossier n&apos;existe plus.</p>
        <Link href="/fichiers" className="underline underline-offset-4">
          Revenir à Mon disque
        </Link>
      </main>
    );
  }
  const selected = uuid(sp.f);
  const [detail, thumbs] = await Promise.all([
    selected ? getFileDetail(selected) : null,
    p.grille
      ? signFiles(drive.files.filter((f) => isImage(f.mime_type)).map((f) => f.id))
      : new Map<string, { url: string }>(),
  ]);

  return (
    <div className="flex-1 flex flex-col lg:flex-row">
      <Sidebar drive={drive} p={p} />
      <main className="flex-1 min-w-0 px-5 py-6 lg:px-10 lg:py-7 flex flex-col gap-6">
        <Toolbar drive={drive} p={p} />
        {detail && (
          <div className="lg:hidden">
            <Panel detail={detail} drive={drive} p={p} />
          </div>
        )}
        {drive.folders.length > 0 && (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
            {drive.folders.map((f) => (
              <li key={f.id}>
                <Link
                  href={href(p, { dossier: f.id })}
                  className="flex items-center gap-3 h-[62px] px-4 rounded-xl bg-papier border border-noir/8 hover:border-noir/20"
                >
                  <IconDossier className="text-doux shrink-0" />
                  <span className="min-w-0 flex flex-col">
                    <span className="text-[15px] truncate">{f.name}</span>
                    <span className="text-xs text-doux">
                      {f.files} fichier{f.files > 1 ? "s" : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {drive.files.length === 0 ? (
          <Empty drive={drive} />
        ) : p.grille ? (
          <Grid files={drive.files} p={p} selected={selected} thumbs={thumbs} />
        ) : (
          <Table files={drive.files} p={p} selected={selected} vue={vue} />
        )}
        {vue === "disque" &&
          drive.folder &&
          drive.folders.length === 0 &&
          drive.files.length === 0 && <DeleteFolder id={drive.folder.id} />}
      </main>
      {detail && (
        <aside className="hidden lg:flex w-[296px] shrink-0 border-l border-trait px-6 py-7 flex-col lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto">
          <Panel detail={detail} drive={drive} p={p} />
        </aside>
      )}
    </div>
  );
}

function Sidebar({ drive, p }: { drive: Drive; p: Params }) {
  const item =
    "flex items-center gap-3 h-10 px-2.5 rounded-lg text-sm shrink-0";
  const on = "bg-papier shadow-[0_0_0_1px_rgba(21,21,21,.08)] font-medium";
  const off = "text-encre hover:bg-lin";
  const pct = drive.quota
    ? Math.min(100, Math.max(drive.used > 0 ? 1 : 0, Math.round((drive.used / drive.quota) * 100)))
    : 0;
  return (
    <aside className="lg:w-[248px] shrink-0 px-5 py-5 lg:py-7 border-b lg:border-b-0 lg:border-r border-trait flex flex-col gap-6 lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto">
      <div className="flex items-center gap-2.5">
        <Link
          href="/aujourdhui"
          aria-label="Retour à l'accueil"
          className="w-9 h-9 shrink-0 rounded-full border border-noir/12 grid place-items-center hover:bg-lin"
        >
          <IconRetour size={16} />
        </Link>
        <Link href="/fichiers" className="titre text-[28px] leading-none">
          Mes fichiers
        </Link>
      </div>
      {p.vue === "disque" && (
        <Importer userId={drive.userId} folderId={drive.folder?.id ?? null} />
      )}
      <nav
        aria-label="Rubriques"
        className="flex lg:flex-col gap-0.5 overflow-x-auto max-lg:-mx-5 max-lg:px-5"
      >
        {VUES.map((v) => {
          const Icon = ICONS[v];
          return (
            <Link
              key={v}
              href={href(p, { vue: v, dossier: null })}
              aria-current={p.vue === v ? "page" : undefined}
              className={`${item} ${p.vue === v ? on : off}`}
            >
              <Icon size={17} />
              {LABELS[v]}
            </Link>
          );
        })}
      </nav>
      <div className="lg:mt-auto flex flex-col gap-2 text-[13px]">
        <p className="flex justify-between gap-2">
          <span>Stockage</span>
          <span className="text-doux">
            {formatBytes(drive.used)} sur {formatBytes(drive.quota)}
          </span>
        </p>
        <div
          className="h-1 rounded-full bg-ivoire overflow-hidden"
          role="progressbar"
          aria-label="Stockage utilisé"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-noir" style={{ width: `${pct}%` }} />
        </div>
        <p className="flex items-center gap-1.5 text-xs text-doux">
          <IconCadenas size={13} />
          Privé, hébergé en Europe
        </p>
      </div>
    </aside>
  );
}

function Toolbar({ drive, p }: { drive: Drive; p: Params }) {
  const toggle =
    "w-9 h-8 rounded-full grid place-items-center aria-[current=true]:bg-papier aria-[current=true]:shadow-[0_0_0_1px_rgba(21,21,21,.08)]";
  return (
    <div className="flex flex-wrap items-center gap-3">
      <nav aria-label="Chemin" className="flex-1 max-sm:basis-full min-w-0 flex flex-wrap items-center gap-2 text-[15px]">
        {p.vue === "disque" && drive.path.length > 0 ? (
          <>
            <Link href={href(p, { dossier: null })} className="text-doux underline underline-offset-4 hover:text-noir">
              Mon disque
            </Link>
            {drive.path.map((f, i) => (
              <span key={f.id} className="flex items-center gap-2">
                <span className="text-doux" aria-hidden>/</span>
                {i === drive.path.length - 1 ? (
                  <span aria-current="page" className="font-medium">{f.name}</span>
                ) : (
                  <Link href={href(p, { dossier: f.id })} className="text-doux underline underline-offset-4 hover:text-noir">
                    {f.name}
                  </Link>
                )}
              </span>
            ))}
          </>
        ) : (
          <h1 className="font-medium">{LABELS[p.vue]}</h1>
        )}
      </nav>
      {p.vue === "disque" && <NewFolder parentId={drive.folder?.id ?? null} />}
      {p.vue === "corbeille" && drive.files.length > 0 && (
        <form action={emptyTrash}>
          <button className="h-10 px-4 rounded-full border border-noir/15 text-sm font-medium hover:bg-lin">
            Vider la corbeille
          </button>
        </form>
      )}
      <div className="flex p-0.5 rounded-full bg-lin" role="group" aria-label="Affichage">
        <Link href={href(p, { grille: false })} aria-current={!p.grille} aria-label="En liste" className={toggle}>
          <IconListe size={16} />
        </Link>
        <Link href={href(p, { grille: true })} aria-current={p.grille} aria-label="En grille" className={toggle}>
          <IconGrille size={16} />
        </Link>
      </div>
    </div>
  );
}

function Badge({ mime, size = 30 }: { mime: string; size?: number }) {
  const t = fileType(mime);
  return (
    <span
      aria-hidden
      className="shrink-0 grid place-items-center rounded-md text-[9px] font-semibold tracking-wide text-casse"
      style={{ width: size, height: size, background: t.color, fontSize: size > 40 ? 13 : 9 }}
    >
      {t.badge}
    </span>
  );
}

function Table({
  files,
  p,
  selected,
  vue,
}: {
  files: FileItem[];
  p: Params;
  selected: string | null;
  vue: Vue;
}) {
  const shared = vue === "partages";
  return (
    <table className="w-full text-[15px] border-collapse">
      <thead>
        <tr className="text-left text-xs text-doux border-b border-trait">
          <th className="font-normal py-2.5 px-2.5">Nom</th>
          <th className="font-normal py-2.5 px-2.5 max-md:hidden">{shared ? "De" : "Lié à"}</th>
          <th className="font-normal py-2.5 px-2.5 max-sm:hidden">
            {vue === "corbeille" ? "Supprimé" : "Modifié"}
          </th>
          <th className="font-normal py-2.5 px-2.5 text-right">Taille</th>
        </tr>
      </thead>
      <tbody>
        {files.map((f) => (
          <tr
            key={f.id}
            aria-selected={selected === f.id}
            className="border-b border-trait aria-selected:bg-papier hover:bg-papier/70"
          >
            <td className="py-0 px-2.5">
              <Link href={href(p, { f: f.id })} className="flex items-center gap-3 h-14 min-w-0">
                <Badge mime={f.mime_type} />
                <span className="truncate">{f.name}</span>
                {f.starred && <IconEtoile filled size={13} className="text-sable shrink-0" />}
              </Link>
            </td>
            <td className="px-2.5 text-encre max-md:hidden truncate max-w-56">
              {shared ? (f.ownerName ?? "") : (f.linkedTo ?? <span className="text-doux">—</span>)}
            </td>
            <td className="px-2.5 text-doux max-sm:hidden whitespace-nowrap">
              {relativeTime(f.trashed_at ?? f.updated_at)}
            </td>
            <td className="px-2.5 text-right text-doux whitespace-nowrap">{formatBytes(f.size_bytes)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Grid({
  files,
  p,
  selected,
  thumbs,
}: {
  files: FileItem[];
  p: Params;
  selected: string | null;
  thumbs: Map<string, { url: string }>;
}) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
      {files.map((f) => {
        const thumb = thumbs.get(f.id)?.url;
        return (
          <li key={f.id}>
            <Link
              href={href(p, { f: f.id })}
              aria-current={selected === f.id || undefined}
              className="flex flex-col rounded-xl bg-papier border border-noir/8 overflow-hidden hover:border-noir/20 aria-[current=true]:border-noir"
            >
              <span className="aspect-[4/3] grid place-items-center bg-lin">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Badge mime={f.mime_type} size={48} />
                )}
              </span>
              <span className="px-3 py-2.5 flex flex-col gap-0.5 min-w-0">
                <span className="text-sm truncate">{f.name}</span>
                <span className="text-xs text-doux">
                  {formatBytes(f.size_bytes)}, {relativeTime(f.updated_at)}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Empty({ drive }: { drive: Drive }) {
  const text: Record<Vue, string> = {
    disque: drive.folder
      ? "Ce dossier est vide. Importe un fichier ou glisse-le sur le bouton « Importer »."
      : "Ton disque est vide. Importe tes polycopiés, photos de tableau ou exposés : ils restent privés tant que tu ne les partages pas.",
    partages:
      "Rien pour l'instant. Les fichiers que les membres de tes cercles et carnets de cours partagent apparaîtront ici.",
    recents: "Aucun fichier pour l'instant.",
    favoris: "Pas encore de favori. Ouvre un fichier et choisis « Ajouter aux favoris ».",
    corbeille: "La corbeille est vide.",
  };
  return <p className="text-doux max-w-prose leading-relaxed py-6">{text[drive.vue]}</p>;
}

function Panel({ detail, drive, p }: { detail: FileDetail; drive: Drive; p: Params }) {
  const { file, mine, previewUrl } = detail;
  const t = fileType(file.mime_type);
  const folderLabel = (id: string): string => {
    const f = drive.allFolders.find((x) => x.id === id);
    if (!f) return "";
    return f.parent_id ? `${folderLabel(f.parent_id)} / ${f.name}` : f.name;
  };
  const meta = [
    t.badge === "FICHIER" ? null : t.badge,
    formatBytes(file.size_bytes),
    mine ? `importé ${relativeTime(file.created_at)}` : `partagé par ${file.ownerName}`,
  ].filter(Boolean);
  const btn = "h-11 rounded-full text-sm font-medium grid place-items-center";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center lg:hidden">
        <span className="text-xs text-doux">Fichier sélectionné</span>
        <Link href={href(p)} className="text-sm underline underline-offset-4">
          Fermer
        </Link>
      </div>
      <div className="aspect-[4/5] rounded-lg bg-papier shadow-[0_1px_0_rgba(21,21,21,.06),0_12px_30px_-18px_rgba(21,21,21,.35)] border border-noir/8 overflow-hidden grid place-items-center">
        {previewUrl && isImage(file.mime_type) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={`Aperçu de ${file.name}`} className="w-full h-full object-contain bg-lin" />
        ) : previewUrl ? (
          <iframe
            src={`${previewUrl}#toolbar=0&view=FitH`}
            title={`Aperçu de ${file.name}`}
            className="w-full h-full bg-papier"
          />
        ) : (
          <Badge mime={file.mime_type} size={64} />
        )}
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-[17px] font-medium break-words">{file.name}</h2>
        <p className="text-xs text-doux">{meta.join(", ")}</p>
        {file.linkedTo && <p className="text-xs text-encre">Lié à : {file.linkedTo}</p>}
      </div>
      {file.trashed_at ? (
        <div className="flex flex-col gap-2.5">
          <form action={restoreFile}>
            <input type="hidden" name="id" value={file.id} />
            <button className={`${btn} w-full bg-noir text-casse`}>Restaurer</button>
          </form>
          <form action={deleteForever}>
            <input type="hidden" name="id" value={file.id} />
            <button className={`${btn} w-full border border-terre/40 text-terre hover:bg-terre/5`}>
              Supprimer définitivement
            </button>
          </form>
          <p className="text-xs text-doux leading-normal">
            Une fois supprimé, le fichier est effacé de nos serveurs et retiré
            des cercles où tu l&apos;avais partagé.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <a href={`/fichiers/ouvrir/${file.id}`} target="_blank" rel="noopener" className={`${btn} bg-noir text-casse`}>
            Ouvrir
          </a>
          <a href={`/fichiers/ouvrir/${file.id}?telecharger=1`} className={`${btn} border border-noir/15 hover:bg-lin`}>
            Télécharger
          </a>
          {mine && (
            <>
              <LinkNote id={file.id} noteId={file.note_id} notes={detail.notes} />
              <ShareToCircle id={file.id} circles={detail.circles} />
              <div className="flex flex-col items-start gap-2.5 pt-3 mt-1 border-t border-trait">
                <form action={toggleStar}>
                  <input type="hidden" name="id" value={file.id} />
                  <input type="hidden" name="starred" value={String(file.starred)} />
                  <button className="flex items-center gap-1.5 text-[13px] text-encre hover:text-noir">
                    <IconEtoile size={15} filled={file.starred} />
                    {file.starred ? "Retirer des favoris" : "Ajouter aux favoris"}
                  </button>
                </form>
                <Rename id={file.id} name={file.name} />
                <Move
                  id={file.id}
                  folderId={file.folder_id}
                  folders={drive.allFolders.map((f) => ({ id: f.id, label: folderLabel(f.id) })).sort((a, b) => a.label.localeCompare(b.label, "fr"))}
                />
                <form action={trashFile}>
                  <button name="id" value={file.id} className="text-[13px] text-terre hover:underline underline-offset-4">
                    Mettre à la corbeille
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
