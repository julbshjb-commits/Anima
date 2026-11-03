import { formatInviteCode } from '@anima/core';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Share, Text, View } from 'react-native';

import { Body, Button, Card, ErrorText, Overline, Screen, Title } from '@/components/ui';
import { createInvite } from '@/lib/data';
import { fonts, useColors } from '@/theme';

const expiryFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export default function Inviter() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const [invite, setInvite] = useState<{ code: string; expires_at: string }>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    setError(undefined);
    try {
      setInvite(await createInvite(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de créer une invitation.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Inviter quelqu’un</Title>
      <Body soft>
        Le code est valable 48 heures. Toute personne qui l’a peut rejoindre ce journal et lire ce qui y est écrit : ne l’envoie qu’aux
        personnes concernées. Ton journal intime, lui, ne peut jamais être partagé.
      </Body>

      {invite ? (
        <Card style={{ gap: 12, alignItems: 'center', paddingVertical: 28 }}>
          <Overline>Code d’invitation</Overline>
          <Text selectable style={{ fontFamily: fonts.texteGras, fontSize: 36, letterSpacing: 6, color: c.texte }}>
            {formatInviteCode(invite.code)}
          </Text>
          <Body soft style={{ textAlign: 'center' }}>{`Expire le ${expiryFmt.format(new Date(invite.expires_at))}. Il ne sera plus affiché ensuite.`}</Body>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button
              label="Envoyer le code"
              onPress={() => Share.share({ message: `Rejoins mon journal sur Anima avec le code ${formatInviteCode(invite.code)}` })}
            />
          </View>
        </Card>
      ) : null}

      <ErrorText>{error}</ErrorText>
      <Button label={invite ? 'Créer un autre code' : 'Créer un code'} ghost={!!invite} onPress={generate} busy={busy} />
    </Screen>
  );
}
