import { JOURNAL_KIND_LABELS } from '@anima/core';
import { Link, Stack, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { Body, Button, Card, Cover, ErrorText, Loading, Overline, Title } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import { createIntimeJournal, listMyJournals, type JournalCard } from '@/lib/data';
import { useLoad } from '@/lib/useLoad';
import { fonts, useColors } from '@/theme';

export default function Journaux() {
  const userId = useUserId();
  const router = useRouter();
  const c = useColors();
  const { data, error, refreshing, refresh } = useLoad(useCallback(() => listMyJournals(userId), [userId]));
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string>();

  async function openIntime() {
    setCreating(true);
    setCreateError(undefined);
    try {
      const id = await createIntimeJournal(userId);
      router.push({ pathname: '/journal/[id]', params: { id } });
    } catch {
      setCreateError('Le journal intime n’a pas pu être créé. Réessaie.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/compte" asChild>
              <Pressable accessibilityRole="button" hitSlop={12}>
                <Text style={{ fontFamily: fonts.texteMoyen, color: c.texte }}>Compte</Text>
              </Pressable>
            </Link>
          ),
        }}
      />
      {!data && !error ? (
        <Loading />
      ) : (
        <ScrollView
          style={{ backgroundColor: c.fond }}
          contentContainerStyle={{ padding: 20, gap: 28, maxWidth: 640, width: '100%', alignSelf: 'center' }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
          <View style={{ gap: 6 }}>
            <Title size={40}>
              Bonjour{data?.me?.display_name ? ', ' : ''}
              {data?.me?.display_name ? <Text style={{ fontFamily: fonts.titreItalique, color: c.champagne }}>{data.me.display_name}</Text> : null}
            </Title>
            <Body soft>Qu’est-ce qui a compté aujourd’hui ?</Body>
          </View>
          <ErrorText>{error}</ErrorText>

          <View style={{ gap: 12 }}>
            <Overline>Pour toi seul</Overline>
            {data?.intime ? (
              <JournalRow journal={data.intime} />
            ) : (
              <Card style={{ gap: 12 }}>
                <Body>Ton journal intime n’est visible que par toi. Personne d’autre ne peut le lire, jamais.</Body>
                <ErrorText>{createError}</ErrorText>
                <Button label="Ouvrir mon journal intime" onPress={openIntime} busy={creating} />
              </Card>
            )}
          </View>

          <View style={{ gap: 12 }}>
            <Overline>Journaux partagés</Overline>
            {data?.shared.length ? (
              data.shared.map((j) => <JournalRow key={j.id} journal={j} />)
            ) : (
              <Body soft>Aucun journal partagé pour l’instant. Crée-en un pour ta famille, tes amis ou ton couple, ou rejoins-en un avec un code.</Body>
            )}
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              <Button label="Nouveau journal" onPress={() => router.push('/nouveau')} />
              <Button label="J’ai un code" ghost onPress={() => router.push('/rejoindre')} />
            </View>
          </View>
        </ScrollView>
      )}
    </>
  );
}

function JournalRow({ journal }: { journal: JournalCard }) {
  const c = useColors();
  const names = journal.members.map((m) => m.display_name).filter(Boolean);
  return (
    <Link href={{ pathname: '/journal/[id]', params: { id: journal.id } }} asChild>
      <Pressable accessibilityRole="link" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Cover id={journal.cover} />
          <View style={{ flex: 1, gap: 2 }}>
            <Title size={24} numberOfLines={1}>
              {journal.title}
            </Title>
            <Text style={{ fontFamily: fonts.texte, fontSize: 13, color: c.doux }} numberOfLines={1}>
              {journal.kind === 'intime' ? 'Privé' : `${JOURNAL_KIND_LABELS[journal.kind]} · ${names.join(', ')}`}
            </Text>
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}
