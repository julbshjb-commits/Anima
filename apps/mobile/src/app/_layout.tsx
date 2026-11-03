import { CormorantGaramond_500Medium } from '@expo-google-fonts/cormorant-garamond/500Medium';
import { CormorantGaramond_500Medium_Italic } from '@expo-google-fonts/cormorant-garamond/500Medium_Italic';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
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
    CormorantGaramond_500Medium,
    CormorantGaramond_500Medium_Italic,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
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
      <StatusBar style="auto" />
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
          <Stack.Screen name="index" options={{ title: 'Journaux' }} />
          <Stack.Screen name="nouveau" options={{ title: 'Nouveau journal', presentation: 'modal' }} />
          <Stack.Screen name="rejoindre" options={{ title: 'Rejoindre', presentation: 'modal' }} />
          <Stack.Screen name="compte" options={{ title: 'Compte' }} />
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
