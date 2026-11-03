import type { Session } from '@supabase/supabase-js';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { supabase } from './supabase';

type AuthState = { session: Session | null; loading: boolean };

const AuthContext = createContext<AuthState>({ session: null, loading: true });

/** Suit la session Supabase et la rend disponible à toute l'appli. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: !!supabase });

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, loading: false }));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setState({ session, loading: false }));
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext value={state}>{children}</AuthContext>;
}

export function useAuth() {
  return use(AuthContext);
}

/** Utilisateur connecté ; à n'appeler que dans les écrans protégés. */
export function useUserId(): string {
  const { session } = useAuth();
  if (!session) throw new Error('Écran protégé appelé sans session.');
  return session.user.id;
}
