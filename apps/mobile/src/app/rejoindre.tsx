import { isValidDeckCode, normalizeInviteCode } from '@anima/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Body, Button, ErrorText, Field, Screen, Title } from '@/components/ui';
import { joinWithCode } from '@/lib/data';

export default function Rejoindre() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function join() {
    // 8 caractères : un paquet de flashcards partagé, qu'on regarde avant de l'ajouter.
    if (isValidDeckCode(code)) return router.replace({ pathname: '/flashcards/code', params: { code: normalizeInviteCode(code) } });
    setBusy(true);
    setError(undefined);
    try {
      const id = await joinWithCode(code);
      router.dismissTo({ pathname: '/journal/[id]', params: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ce code ne fonctionne pas.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Rejoindre un journal</Title>
      <Body soft>Entre le code que l’on t’a envoyé : un journal partagé, ou un paquet de flashcards de ta promo.</Body>
      <Field
        label="Code d’invitation"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="K7M-Q2P"
        maxLength={10}
        autoFocus
        onSubmitEditing={join}
        style={{ fontSize: 22, letterSpacing: 4 }}
      />
      <ErrorText>{error}</ErrorText>
      <Button label="Rejoindre" onPress={join} busy={busy} />
    </Screen>
  );
}
