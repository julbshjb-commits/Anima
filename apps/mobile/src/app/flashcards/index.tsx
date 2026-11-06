import { coverOf } from '@anima/core';
import { Link, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { Body, Button, Card, ErrorText, Loading, Overline, Title } from '@/components/ui';
import { loadFlashcards, type DeckRow } from '@/lib/flashcards';
import { useLoad } from '@/lib/useLoad';
import { fonts, useColors } from '@/theme';

/** Paquets et cartes du jour. Créer et modifier les cartes se fait sur anima (web), y compris sur téléphone. */
export default function Flashcards() {
  const c = useColors();
  const router = useRouter();
  const { data, error, refreshing, refresh } = useLoad(useCallback(() => loadFlashcards(), []));
  if (!data && !error) return <Loading />;
  const due = data?.queue.length ?? 0;
  const groups = new Map<string, DeckRow[]>();
  for (const d of data?.decks ?? []) groups.set(d.subject ?? '', [...(groups.get(d.subject ?? '') ?? []), d]);
  return (
    <ScrollView
      style={{ backgroundColor: c.fond }}
      contentContainerStyle={{ padding: 20, gap: 24, maxWidth: 640, width: '100%', alignSelf: 'center' }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <ErrorText>{error}</ErrorText>
      <Card style={{ gap: 14, backgroundColor: '#141415' }}>
        <Overline>Aujourd’hui</Overline>
        <Title size={36}>
          {due ? `${due} carte${due > 1 ? 's' : ''} ` : 'Tout est révisé'}
          {due ? <Text style={{ fontFamily: fonts.titreItalique, color: c.champagne }}>à revoir</Text> : null}
        </Title>
        <Body soft>
          {data?.doneToday ?? 0} / {data?.goal} réponses aujourd’hui{data && data.streak > 1 ? ` · ${data.streak} jours d’affilée` : ''}
        </Body>
        {due > 0 && (
          <Button label="Commencer la révision" onPress={() => router.push('/flashcards/reviser')} />
        )}
      </Card>
      {[...groups.entries()].map(([subject, decks]) => (
        <View key={subject || 'sans'} style={{ gap: 12 }}>
          <Overline>{subject || 'Sans matière'}</Overline>
          {decks.map((d) => (
            <Link key={d.id} href={{ pathname: '/flashcards/reviser', params: { paquet: d.id } }} asChild>
              <Pressable accessibilityRole="link" disabled={!d.due && !d.fresh} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{ width: 36, height: 48, borderRadius: 6, backgroundColor: coverOf(d.cover).bg }} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Title size={22} numberOfLines={1}>
                      {d.title}
                    </Title>
                    <Text style={{ fontFamily: fonts.texte, fontSize: 13, color: d.due ? c.champagne : c.doux }}>
                      {d.due} à revoir · {d.fresh} nouvelle{d.fresh > 1 ? 's' : ''} · {d.total} carte{d.total > 1 ? 's' : ''}
                    </Text>
                  </View>
                </Card>
              </Pressable>
            </Link>
          ))}
        </View>
      ))}
      {data?.decks.length === 0 && <Body soft>Crée ton premier paquet sur anima, depuis l’ordinateur ou le navigateur du téléphone : il apparaîtra ici.</Body>}
    </ScrollView>
  );
}
