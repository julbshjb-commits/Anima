import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { Body, Button, Card, ErrorText, Field, Overline, Screen, Title } from '@/components/ui';
import { useAuth, useUserId } from '@/lib/auth';
import { updateDisplayName } from '@/lib/data';
import { requireClient } from '@/lib/supabase';

/** Adresse du site web, quand il sera en ligne (l'export des données s'y fait pour l'instant). */
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

  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();

  /**
   * Suppression définitive (fonction serveur supprimer-compte) : les journaux
   * partagés sont transmis aux autres membres, tout le reste est effacé.
   */
  function askDelete() {
    if (confirmText.trim() !== 'SUPPRIMER') return setDeleteError('Écris SUPPRIMER pour confirmer.');
    Alert.alert('Supprimer ton compte ?', 'Ton journal intime, tes entrées et tes photos seront effacés définitivement.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          setDeleteError(undefined);
          const client = requireClient();
          const { error: fnErr } = await client.functions.invoke('supprimer-compte', { body: { confirm: 'SUPPRIMER' } });
          if (fnErr) {
            setDeleting(false);
            return setDeleteError('La suppression a échoué. Rien n’a été effacé, réessaie plus tard.');
          }
          // La session n'est plus valable : on la retire seulement de l'appareil.
          await client.auth.signOut({ scope: 'local' });
        },
      },
    ]);
  }

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
          <Body soft>L’export de toutes tes données se fait sur le site, avec la même adresse e-mail.</Body>
          <Button label="Exporter mes données sur le site" ghost onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/compte`)} />
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

      <Card style={{ gap: 12 }}>
        <Overline>Supprimer mon compte</Overline>
        <Body soft>
          Ton journal intime, tes entrées et tes photos sont effacés définitivement. Les journaux partagés que tu as créés sont confiés au
          membre le plus ancien, pour que les autres gardent leurs souvenirs.
        </Body>
        <Field label="Écris SUPPRIMER pour confirmer" value={confirmText} onChangeText={setConfirmText} autoCapitalize="characters" autoCorrect={false} />
        <ErrorText>{deleteError}</ErrorText>
        <Button label="Supprimer définitivement" ghost onPress={askDelete} busy={deleting} />
      </Card>
    </Screen>
  );
}
