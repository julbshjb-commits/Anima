import { coverOf, dayBounds, daysUntil, examLabel, nextExam } from '@anima/core';
import { Link, Stack, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { Body, Button, Card, ErrorText, Loading, Overline, Title } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import { loadHome, type DeckRow } from '@/lib/flashcards';
import { useLoad } from '@/lib/useLoad';
import { fonts, useColors } from '@/theme';

/** Accueil de l'appli : les cartes du jour et les paquets. Le reste d'Anima vient en plus. */
export default function Accueil() {
  const c = useColors();
  const router = useRouter();
  const userId = useUserId();
  const { data, error, refreshing, refresh } = useLoad(useCallback(() => loadHome(userId), [userId]));

  const header = (
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
  );
  if (!data && !error)
    return (
      <>
        {header}
        <Loading />
      </>
    );

  const today = dayBounds().day;
  const due = data?.queue.length ?? 0;
  const exam = data ? nextExam(data.decks, today) : null;
  const hour = new Date().getHours();
  const groups = new Map<string, DeckRow[]>();
  for (const d of data?.decks ?? []) groups.set(d.subject ?? '', [...(groups.get(d.subject ?? '') ?? []), d]);

  return (
    <>
      {header}
      <ScrollView
        style={{ backgroundColor: c.fond }}
        contentContainerStyle={{ padding: 20, gap: 24, maxWidth: 640, width: '100%', alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <View style={{ gap: 6 }}>
          <Title size={40}>
            {hour >= 18 || hour < 5 ? 'Bonsoir' : 'Bonjour'}
            {data?.name ? ' ' : ''}
            {data?.name ? <Text style={{ fontFamily: fonts.titreItalique, color: c.champagne }}>{data.name}</Text> : null}
          </Title>
        </View>
        <ErrorText>{error}</ErrorText>

        {data && data.decks.length === 0 ? (
          <Card style={{ gap: 14, backgroundColor: '#141415', borderColor: 'rgba(230,200,145,0.25)' }}>
            <Overline>Premier pas</Overline>
            <Title size={32}>
              Quelle matière <Text style={{ fontFamily: fonts.titreItalique, color: c.champagne }}>tu révises ?</Text>
            </Title>
            <Body soft>Crée ton premier paquet, ou ajoute celui de ta promo avec un code. Chaque réponse règle la prochaine révision.</Body>
            <Button label="Créer mon premier paquet" onPress={() => router.push('/flashcards/nouveau')} />
            <Button label="J’ai un code de ma promo" ghost onPress={() => router.push('/flashcards/code')} />
            <Text style={{ fontFamily: fonts.texte, fontSize: 12, lineHeight: 18, color: c.doux }}>
              Pour transformer un cours ou un PDF en cartes, ouvre anima sur le site : les cartes arrivent ici.
            </Text>
          </Card>
        ) : (
          <Card style={{ gap: 14, backgroundColor: '#141415', borderColor: 'rgba(230,200,145,0.25)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <Overline>Aujourd’hui</Overline>
              {exam ? (
                <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.texteMoyen, fontSize: 12, color: c.champagne }}>
                  {exam.days === 0 ? 'Jour J' : `J-${exam.days}`} · {exam.title}
                </Text>
              ) : null}
            </View>
            <Title size={38}>
              {due ? `${due} carte${due > 1 ? 's' : ''} ` : 'Tout est révisé'}
              {due ? <Text style={{ fontFamily: fonts.titreItalique, color: c.champagne }}>à revoir</Text> : null}
            </Title>
            <Body soft>
              {due ? `environ ${Math.max(1, Math.round((due * 8) / 60))} min · ` : ''}
              {data?.doneToday ?? 0} / {data?.goal} réponses aujourd’hui{data && data.streak > 1 ? ` · ${data.streak} jours d’affilée` : ''}
            </Body>
            {due > 0 && <Button label="Commencer la révision" onPress={() => router.push('/flashcards/reviser')} />}
          </Card>
        )}

        {data && data.decks.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="Nouveau paquet" ghost onPress={() => router.push('/flashcards/nouveau')} style={{ flex: 1, paddingHorizontal: 12 }} />
            <Button label="Avec un code" ghost onPress={() => router.push('/flashcards/code')} style={{ flex: 1, paddingHorizontal: 12 }} />
          </View>
        )}

        {[...groups.entries()].map(([subject, decks]) => (
          <View key={subject || 'sans'} style={{ gap: 12 }}>
            <Overline>{subject || 'Sans matière'}</Overline>
            {decks.map((d) => (
              <DeckLink key={d.id} d={d} today={today} />
            ))}
          </View>
        ))}

        <View style={{ gap: 12 }}>
          <Overline>Aussi dans Anima</Overline>
          <Link href="/journaux" asChild>
            <Pressable accessibilityRole="link" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Title size={22}>Journaux</Title>
                  <Text style={{ fontFamily: fonts.texte, fontSize: 13, color: c.doux }}>Ton journal intime et vos journaux partagés</Text>
                </View>
                <Text style={{ fontFamily: fonts.texteMoyen, color: c.champagne }}>Ouvrir</Text>
              </Card>
            </Pressable>
          </Link>
          <Text style={{ fontFamily: fonts.texte, fontSize: 12, lineHeight: 18, color: c.doux }}>
            Notes de cours, Organiser, Cercles, Bibliothèque et Fichiers sont sur anima, le site.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

function DeckLink({ d, today }: { d: DeckRow; today: string }) {
  const c = useColors();
  const exam = d.exam_date ? daysUntil(d.exam_date, today) : null;
  return (
    <Link href={{ pathname: '/flashcards/paquet', params: { id: d.id } }} asChild>
      <Pressable accessibilityRole="link" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 36, height: 48, borderRadius: 6, backgroundColor: coverOf(d.cover).bg }} />
          <View style={{ flex: 1, gap: 3 }}>
            <Title size={22} numberOfLines={1}>
              {d.title}
            </Title>
            <Text style={{ fontFamily: fonts.texte, fontSize: 13, color: c.doux }}>
              {d.total} carte{d.total > 1 ? 's' : ''} · {d.fresh} nouvelle{d.fresh > 1 ? 's' : ''}
              {d.share_code ? ' · partagé' : d.source_deck_id ? ' · de ta promo' : ''}
            </Text>
            {exam != null && exam >= 0 ? (
              <Text style={{ fontFamily: fonts.texteMoyen, fontSize: 12, color: c.champagne }}>Examen {examLabel(exam)}</Text>
            ) : null}
          </View>
          {d.due > 0 ? <Text style={{ fontFamily: fonts.texteGras, fontSize: 15, color: c.champagne }}>{d.due}</Text> : null}
        </Card>
      </Pressable>
    </Link>
  );
}
