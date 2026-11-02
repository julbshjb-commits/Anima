/**
 * Affiché tant que les variables Supabase ne sont pas définies.
 * Aucune donnée fictive : on dit simplement ce qui manque.
 */
export function NotConfigured() {
  return (
    <main className="mx-auto max-w-lg px-6 py-24 flex flex-col gap-4">
      <p className="surtitre">Configuration</p>
      <h1 className="titre text-4xl">Anima n'est pas encore relié à sa base de données.</h1>
      <p className="text-doux leading-relaxed">
        Copie <code>apps/web/.env.example</code> en <code>.env.local</code> et renseigne l'adresse et la clé
        publique du projet Supabase. Les journaux apparaîtront ici dès que la base répondra.
      </p>
    </main>
  );
}
