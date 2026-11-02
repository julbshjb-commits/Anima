import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Body, Button, Card, ErrorText, Field, Overline, Screen, Title } from '@/components/ui';
import { useAuth, useUserId } from '@/lib/auth';
import { updateDisplayName } from '@/lib/data';
import { requireClient } from '@/lib/supabase';

/** Adresse du site web, quand il sera en ligne (export et suppression du compte s'y font pour l'instant). */
const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL;

export default function Compte() {
  const userId = useUserId();
  const { session } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [msg, setMsg] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    requireClient()
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => setName(data?.display_name ?? ''));
  }, [userId]);

  async function save() {
    setBusy(true);
    setError(undefined);
    setMsg(undefined);
    try {
      await updateDisplayName(userId, name);
      setMsg('Enregistré.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Ton compte</Title>
      <Body soft>{session?.user.email}</Body>

      <Card style={{ gap: 14 }}>
        <Field label="Prénom affiché" value={name} onChangeText={setName} maxLength={60} />
        <ErrorText>{error}</ErrorText>
        {msg ? <Body soft>{msg}</Body> : null}
        <Button label="Enregistrer" onPress={save} busy={busy} />
      </Card>

      {SITE_URL ? (
        <View style={{ gap: 10 }}>
          <Overline>Tes données</Overline>
          <Body soft>L’export de tes données et la suppression du compte se font sur le site, avec la même adresse e-mail.</Body>
          <Button label="Ouvrir mon compte sur le site" ghost onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/compte`)} />
        </View>
      ) : null}

      <Button
        label="Me déconnecter"
        ghost
        onPress={async () => {
          await requireClient().auth.signOut();
          router.replace('/connexion');
        }}
      />
    </Screen>
  );
}
