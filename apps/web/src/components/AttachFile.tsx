"use client";
import { useRef, useState, useTransition } from "react";
import { FILE_ACCEPT, fileType } from "@anima/core";
import { uploadToDrive } from "@/lib/upload";
import { IconPhoto } from "./icons";

/**
 * « Joindre une photo ou un fichier » : envoie le fichier dans le disque
 * privé (Mes fichiers), puis met son id dans un champ caché du formulaire.
 * Il ne devient visible des autres qu'une fois la publication envoyée.
 */
export function AttachFile({
  userId,
  name = "fileId",
  label = "Joindre une photo ou un fichier",
  accept = FILE_ACCEPT,
}: {
  userId: string;
  name?: string;
  label?: string;
  accept?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ id: string; name: string; type: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function pick(f: File | undefined) {
    if (!f) return;
    setError(null);
    start(async () => {
      const res = await uploadToDrive(userId, f);
      if ("error" in res) setError(res.error);
      else setFile({ id: res.id, name: f.name, type: f.type });
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {file && <input type="hidden" name={name} value={file.id} />}
      <input
        ref={input}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {file ? (
        <span className="flex items-center gap-2 h-9 pl-1.5 pr-3 rounded-full bg-lin text-[13px] max-w-full">
          <span
            className="w-6 h-6 rounded grid place-items-center text-[8px] font-semibold text-blanc shrink-0"
            style={{ background: fileType(file.type).color }}
            aria-hidden
          >
            {fileType(file.type).badge}
          </span>
          <span className="truncate max-w-48">{file.name}</span>
          <button
            type="button"
            onClick={() => setFile(null)}
            className="text-doux hover:text-noir underline underline-offset-4"
          >
            Retirer
          </button>
        </span>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => input.current?.click()}
          className="flex items-center gap-2 h-9 px-3 rounded-full border border-noir/12 text-[13px] text-encre hover:bg-lin disabled:opacity-60"
        >
          <IconPhoto size={15} />
          {pending ? "Envoi…" : label}
        </button>
      )}
      {error && (
        <span role="alert" className="text-xs text-terre">
          {error}
        </span>
      )}
    </div>
  );
}
