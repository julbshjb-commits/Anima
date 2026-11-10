import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Body, Button, ErrorText, Field, Screen, Title } from '@/components/ui';
import { createDeck } from '@/lib/flashcards';

/** Nouveau paquet : un nom et une matière, puis on ajoute les cartes. */
export default function NouveauPaquet() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setError(undefined);
    try {
      const id = await createDeck(title, subject);
      router.dismissTo({ pathname: '/flashcards/paquet', params: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Le paquet n’a pas pu être créé.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Nouveau paquet</Title>
      <Body soft>Un paquet par chapitre ou par cours : tu y ajoutes tes cartes, et Anima te les fait réviser au bon moment.</Body>
      <Field label="Nom du paquet" value={title} onChangeText={setTitle} placeholder="Anatomie du cœur" maxLength={120} autoFocus returnKeyType="next" />
      <Field label="Matière (facultatif)" value={subject} onChangeText={setSubject} placeholder="Médecine" maxLength={80} onSubmitEditing={create} />
      <ErrorText>{error}</ErrorText>
      <Button label="Créer le paquet" onPress={create} busy={busy} disabled={!title.trim()} />
    </Screen>
  );
}
