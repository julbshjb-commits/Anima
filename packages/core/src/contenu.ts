/**
 * Contenu des entrées. On stocke le texte brut (recherche, export) et un
 * document Tiptap minimal, prêt pour l'éditeur riche qui viendra plus tard.
 */
export type TiptapDoc = {
  type: "doc";
  content: { type: "paragraph"; content: { type: "text"; text: string }[] }[];
};

export function textToDoc(text: string): TiptapDoc {
  return {
    type: "doc",
    content: text.split(/\n{2,}/).map((p) => ({
      type: "paragraph",
      content: p ? [{ type: "text", text: p }] : [],
    })),
  };
}
