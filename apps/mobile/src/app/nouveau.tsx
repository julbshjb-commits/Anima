import { COVERS, JOURNAL_KIND_LABELS, SHARED_JOURNAL_KINDS, createJournalSchema, type JournalKind } from '@anima/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Cover, ErrorText, Field, Overline, Screen, Title } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import { createSharedJournal } from '@/lib/data';
import { fonts, useColors } from '@/theme';

export default function Nouveau() {
  const userId = useUserId();
  const router = useRouter();
  const c = useColors();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<JournalKind>('famille');
  const [cover, setCover] = useState<string>(COVERS[0].id);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function create() {
    const parsed = createJournalSchema.safeParse({ title, kind, cover });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setBusy(true);
    setError(undefined);
    try {
      const id = await createSharedJournal(userId, parsed.data);
      router.dismissTo({ pathname: '/journal/[id]', params: { id } });
      router.push({ pathname: '/journal/[id]/inviter', params: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Le journal n’a pas pu être créé.');
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Nouveau journal partagé</Title>
      <Field label="Titre" value={title} onChangeText={setTitle} maxLength={80} placeholder="Les dimanches en famille" />

      <View style={{ gap: 10 }}>
        <Overline>Pour qui ?</Overline>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {SHARED_JOURNAL_KINDS.map((k) => (
            <Pressable
              key={k}
              accessibilityRole="radio"
              accessibilityState={{ checked: kind === k }}
              onPress={() => setKind(k)}
              style={{
                height: 38,
                paddingHorizontal: 14,
                borderRadius: 999,
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: kind === k ? c.texte : c.trait,
                backgroundColor: kind === k ? c.surface : 'transparent',
              }}>
              <Text style={{ fontFamily: fonts.texte, fontSize: 14, color: c.texte }}>{JOURNAL_KIND_LABELS[k]}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Overline>Couverture</Overline>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {COVERS.map((cv) => (
            <Pressable
              key={cv.id}
              accessibilityRole="radio"
              accessibilityLabel={cv.label}
              accessibilityState={{ checked: cover === cv.id }}
              onPress={() => setCover(cv.id)}
              style={{ padding: 3, borderRadius: 9, borderWidth: 2, borderColor: cover === cv.id ? c.texte : 'transparent' }}>
              <Cover id={cv.id} size={64} />
            </Pressable>
          ))}
        </View>
      </View>

      <ErrorText>{error}</ErrorText>
      <Button label="Créer et inviter" onPress={create} busy={busy} />
    </Screen>
  );
}
