import { Fraunces_300Light } from '@expo-google-fonts/fraunces/300Light';
import { Fraunces_300Light_Italic } from '@expo-google-fonts/fraunces/300Light_Italic';
import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Body, Screen, Title } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { fonts, useColors } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fraunces_300Light,
    Fraunces_300Light_Italic,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
  });
  return <AuthProvider>{fontsLoaded ? <Navigation /> : null}</AuthProvider>;
}

function Navigation() {
  const { session, loading } = useAuth();
  const c = useColors();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;
  if (!supabase) return <NotConfigured />;

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: c.fond },
          headerTintColor: c.texte,
          headerTitleStyle: { fontFamily: fonts.texteMoyen },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: c.fond },
        }}>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="index" options={{ title: 'Flashcards' }} />
          <Stack.Screen name="journaux" options={{ title: 'Journaux' }} />
          <Stack.Screen name="nouveau" options={{ title: 'Nouveau journal', presentation: 'modal' }} />
          <Stack.Screen name="rejoindre" options={{ title: 'Rejoindre', presentation: 'modal' }} />
          <Stack.Screen name="compte" options={{ title: 'Compte' }} />
          <Stack.Screen name="flashcards/paquet" options={{ title: '' }} />
          <Stack.Screen name="flashcards/nouveau" options={{ title: 'Nouveau paquet', presentation: 'modal' }} />
          <Stack.Screen name="flashcards/code" options={{ title: 'Paquet partagé', presentation: 'modal' }} />
          <Stack.Screen name="flashcards/reviser" options={{ title: 'Révision', presentation: 'fullScreenModal' }} />
          <Stack.Screen name="journal/[id]/index" options={{ title: '' }} />
          <Stack.Screen name="journal/[id]/ecrire" options={{ title: 'Écrire', presentation: 'modal' }} />
          <Stack.Screen name="journal/[id]/inviter" options={{ title: 'Inviter', presentation: 'modal' }} />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="connexion" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

/** Affiché quand apps/mobile/.env n'est pas rempli, au lieu d'une appli qui fait semblant. */
function NotConfigured() {
  return (
    <Screen>
      <Title>Configuration manquante</Title>
      <Body>
        Copie apps/mobile/.env.example vers apps/mobile/.env, renseigne l’URL du projet Supabase et la clé publique, puis
        relance « pnpm --filter @anima/mobile start ».
      </Body>
    </Screen>
  );
}
