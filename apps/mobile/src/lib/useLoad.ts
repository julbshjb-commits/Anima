import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/**
 * Charge des données à chaque fois que l'écran revient au premier plan.
 * `load` doit être stable (useCallback) : il change quand ses paramètres changent.
 */
export function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    try {
      setData(await load());
      setError(undefined);
    } catch {
      setError('Impossible de charger. Vérifie ta connexion.');
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  return { data, error, refreshing, refresh, reload };
}
