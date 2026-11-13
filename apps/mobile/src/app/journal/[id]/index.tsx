import { formatLongDate, monthGrid, MOOD_META, toIsoDate, type Mood } from '@anima/core';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { Body, Button, Card, ErrorText, Loading, MoodDot, Overline, Title } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import { getJournal, getMonthEntries } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { useLoad } from '@/lib/useLoad';
import { fonts, useColors } from '@/theme';

const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export default function JournalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const router = useRouter();
  const c = useColors();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const grid = useMemo(() => monthGrid(month.y, month.m), [month]);
  const from = toIsoDate(new Date(month.y, month.m, 1));
  const to = toIsoDate(new Date(month.y, month.m + 1, 0));

  const load = useCallback(async () => {
    const j = await getJournal(id, userId);
    return j ? { ...j, entries: await getMonthEntries(id, from, to) } : null;
  }, [id, userId, from, to]);
  const { data, error, refreshing, refresh, reload } = useLoad(load);

  // Temps réel : une entrée ajoutée par un autre membre apparaît sans recharger.
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const channel = client
      .channel(`journal:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'journal_entries', filter: `journal_id=eq.${id}` }, () => reload())
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [id, reload]);

  if (data === undefined && !error) return <Loading />;
  if (data === null) {
    return (
      <View style={{ flex: 1, padding: 24, gap: 12, backgroundColor: c.fond }}>
        <Title>Journal introuvable</Title>
        <Body soft>Il n’existe pas, ou tu n’en fais pas partie.</Body>
      </View>
    );
  }

  const moodByDay = new Map<string, Mood>();
  for (const e of [...(data?.entries ?? [])].reverse()) if (e.mood) moodByDay.set(e.entry_date, e.mood);
  const canWrite = data?.myRole !== 'reader';
  const isIntime = data?.journal.kind === 'intime';
  const authorName = (authorId: string) => data?.members.find((m) => m.id === authorId)?.display_name ?? '';

  return (
    <>
      <Stack.Screen options={{ title: data?.journal.title ?? '' }} />
      <ScrollView
        style={{ backgroundColor: c.fond }}
        contentContainerStyle={{ padding: 20, gap: 24, maxWidth: 640, width: '100%', alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <ErrorText>{error}</ErrorText>

        <View style={{ gap: 4 }}>
          <Overline>{isIntime ? 'Privé · visible par toi seul' : data?.members.map((m) => m.display_name).join(', ')}</Overline>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {canWrite ? (
            <Button label="Écrire" onPress={() => router.push({ pathname: '/journal/[id]/ecrire', params: { id, date: toIsoDate(new Date()) } })} />
          ) : null}
          {!isIntime && canWrite ? (
            <Button label="Inviter" ghost onPress={() => router.push({ pathname: '/journal/[id]/inviter', params: { id } })} />
          ) : null}
        </View>

        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <MonthArrow label="Mois précédent" glyph="‹" onPress={() => setMonth(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))} />
            <Title size={22} style={{ textTransform: 'capitalize' }}>
              {monthFmt.format(new Date(month.y, month.m, 1))}
            </Title>
            <MonthArrow label="Mois suivant" glyph="›" onPress={() => setMonth(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))} />
          </View>
          <View style={{ flexDirection: 'row' }}>
            {WEEKDAYS.map((d, i) => (
              <Text key={i} style={{ flex: 1, textAlign: 'center', fontFamily: fonts.texte, fontSize: 12, color: c.doux }}>
                {d}
              </Text>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {grid.map((day, i) => {
              const mood = day ? moodByDay.get(day) : undefined;
              const today = day === toIsoDate(new Date());
              return (
                <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 3 }}>
                  {day ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${formatLongDate(day)}${mood ? `, ${MOOD_META[mood].label}` : ''}`}
                      disabled={!canWrite}
                      onPress={() => router.push({ pathname: '/journal/[id]/ecrire', params: { id, date: day } })}
                      style={{
                        flex: 1,
                        borderRadius: 999,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: mood ? MOOD_META[mood].color : 'transparent',
                        borderWidth: today ? 1 : 0,
                        borderColor: c.texte,
                      }}>
                      <Text style={{ fontFamily: fonts.texte, fontSize: 13, color: mood ? '#16130F' : c.texte }}>{Number(day.slice(8))}</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        </Card>

        <View style={{ gap: 14 }}>
          {data?.entries.length ? (
            data.entries.map((e) => (
              <Card key={e.id} style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MoodDot mood={e.mood} />
                  <View style={{ flex: 1 }}>
                    <Overline>
                      {formatLongDate(e.entry_date)}
                      {!isIntime && authorName(e.author_id) ? ` · ${authorName(e.author_id)}` : ''}
                    </Overline>
                  </View>
                  {canWrite && e.author_id === userId ? (
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={10}
                      onPress={() => router.push({ pathname: '/journal/[id]/ecrire', params: { id, entryId: e.id } })}>
                      <Text style={{ fontFamily: fonts.texteMoyen, fontSize: 13, color: c.doux }}>Modifier</Text>
                    </Pressable>
                  ) : null}
                </View>
                {e.title ? <Title size={26}>{e.title}</Title> : null}
                <Body style={{ fontSize: 16, lineHeight: 25 }}>{e.content_text}</Body>
                {e.photos.length ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {e.photos.map((p) => (
                      <Image
                        key={p.id}
                        source={{ uri: p.url }}
                        accessibilityLabel="Photo de l’entrée"
                        contentFit="cover"
                        style={{ width: e.photos.length === 1 ? '100%' : '48%', aspectRatio: e.photos.length === 1 ? 4 / 3 : 1, borderRadius: 12 }}
                      />
                    ))}
                  </View>
                ) : null}
                {!isIntime && e.author_id === userId ? (
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel="Publier cette page sur le réseau Anima"
                    hitSlop={10}
                    onPress={() => router.push({ pathname: '/decouvrir/publier', params: { journal: id, entree: e.id } })}
                    style={{ alignSelf: 'flex-start' }}>
                    <Text style={{ fontFamily: fonts.texteMoyen, fontSize: 13, color: c.champagne }}>Publier sur le réseau</Text>
                  </Pressable>
                ) : null}
              </Card>
            ))
          ) : (
            <Body soft>Aucune entrée ce mois-ci.</Body>
          )}
        </View>
      </ScrollView>
    </>
  );
}

function MonthArrow({ label, glyph, onPress }: { label: string; glyph: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={10} onPress={onPress} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 26, color: c.texte }}>{glyph}</Text>
    </Pressable>
  );
}
