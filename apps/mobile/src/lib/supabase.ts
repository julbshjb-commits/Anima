/**
 * Client Supabase de l'appli mobile.
 *
 * - La session est rangée dans le localStorage fourni par expo-sqlite
 *   (fichier local à l'appareil, jamais envoyé ailleurs).
 * - Seule la clé publique est embarquée : toute la sécurité repose sur la RLS.
 *   La clé secrète ne doit jamais apparaître dans ce dossier.
 */
import 'expo-sqlite/localStorage/install';

import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import type { Database } from '@anima/core';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** null quand le fichier .env n'est pas rempli : l'appli l'explique au lieu de planter. */
export const supabase =
  url && key
    ? createClient<Database>(url, key, {
        auth: {
          storage: localStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

// Le jeton ne se rafraîchit que quand l'appli est au premier plan.
if (supabase) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export type Supabase = NonNullable<typeof supabase>;

export function requireClient(): Supabase {
  if (!supabase) throw new Error('Supabase n’est pas configuré.');
  return supabase;
}
