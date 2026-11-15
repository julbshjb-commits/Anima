/**
 * Aperçu animé pendant qu'une page se charge : la silhouette de l'écran
 * (titre, grande carte, petites cartes) avec un reflet qui passe, au lieu
 * d'un simple « Chargement… ». `pleine` ajoute les marges d'une page entière.
 */
export function Apercu({ pleine = false, forme = "cartes" }: { pleine?: boolean; forme?: "cartes" | "liste" }) {
  return (
    <div role="status" aria-label="Chargement" className={`apercu flex flex-col gap-6 ${pleine ? "px-5 sm:px-8 lg:px-12 py-8 lg:py-12 max-w-5xl w-full mx-auto" : ""}`}>
      <div className="flex flex-col gap-3">
        <i className="h-3 w-28 rounded-full" />
        <i className="h-9 w-64 max-w-[70%] rounded-xl" />
      </div>
      {forme === "cartes" ? (
        <>
          <i className="h-40 sm:h-48 rounded-3xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <i className="h-28 rounded-2xl" />
            <i className="h-28 rounded-2xl" />
            <i className="h-28 rounded-2xl hidden xl:block" />
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((n) => (
            <i key={n} className="h-16 rounded-2xl" style={{ opacity: 1 - n * 0.15 }} />
          ))}
        </div>
      )}
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
