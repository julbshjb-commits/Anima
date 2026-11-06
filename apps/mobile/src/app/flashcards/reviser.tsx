import { LEARN_AHEAD_MS, RATINGS, nextSchedule, previewDelays, renderCloze, type Rating } from '@anima/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, ErrorText, Loading, Overline, Title } from '@/components/ui';
import { loadFlashcards, recordReview, type StudyItem } from '@/lib/flashcards';
import { fonts, useColors } from '@/theme';

const TONES: Record<Rating, string> = { 1: '#F0A094', 2: '#DCD8D2', 3: '#A9CDB3', 4: '#E6C891' };

/** Séance de révision tactile : toucher pour retourner, glisser à droite « Bien », à gauche « À revoir ». */
export default function Reviser() {
  const c = useColors();
  const router = useRouter();
  const { paquet } = useLocalSearchParams<{ paquet?: string }>();
  const [queue, setQueue] = useState<StudyItem[]>();
  const [error, setError] = useState<string>();
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);
  const [flip] = useState(() => new Animated.Value(0));
  const [pan] = useState(() => new Animated.Value(0));
  const shownAt = useRef(0);
  const chain = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    loadFlashcards(paquet ?? null)
      .then((d) => setQueue(d.queue))
      .catch(() => setError('Les cartes n’ont pas pu être chargées.'));
  }, [paquet]);

  const item = queue?.[0];
  useEffect(() => {
    shownAt.current = Date.now();
  }, [item?.id, done]);
  const delays = useMemo(() => (item ? previewDelays(item.schedule) : null), [item]);

  const reveal = useCallback(() => {
    setRevealed(true);
    Animated.spring(flip, { toValue: 1, useNativeDriver: true, friction: 8, tension: 40 }).start();
  }, [flip]);

  const rate = useCallback(
    (rating: Rating) => {
      if (!item) return;
      const next = nextSchedule(item.schedule, rating, new Date(), () => 0.5);
      const elapsed = Date.now() - shownAt.current;
      chain.current = chain.current.then(() => recordReview(item, rating, elapsed).catch(() => setError('Une réponse n’a pas pu être enregistrée.')));
      Animated.timing(pan, { toValue: rating === 1 ? -500 : 500, duration: 220, useNativeDriver: true }).start(() => {
        setQueue((q) => {
          const rest = (q ?? []).slice(1);
          if (Date.parse(next.due_at) - Date.now() > LEARN_AHEAD_MS) return rest;
          const at = Math.min(rest.length, rating === 1 ? 3 : 6);
          return [...rest.slice(0, at), { ...item, schedule: { ...item.schedule, ...next } }, ...rest.slice(at)];
        });
        setDone((n) => n + 1);
        setRevealed(false);
        flip.setValue(0);
        pan.setValue(0);
      });
    },
    [item, flip, pan],
  );

  // Les gestes ne lisent les refs qu'au moment du glissement, jamais pendant le rendu.
  const responder = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => revealed && Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: (_e, g) => pan.setValue(g.dx),
        onPanResponderRelease: (_e, g) => {
          if (Math.abs(g.dx) > 110) rate(g.dx > 0 ? 3 : 1);
          else Animated.spring(pan, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [revealed, pan, rate],
  );

  if (error && !queue) return <ErrorText>{error}</ErrorText>;
  if (!queue) return <Loading />;

  if (!item)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.fond, padding: 24, gap: 20, justifyContent: 'center' }}>
        <Overline>{done ? 'Séance terminée' : 'Rien à réviser'}</Overline>
        <Title size={40}>{done ? `${done} réponse${done > 1 ? 's' : ''}. Bravo.` : 'Tout est à jour.'}</Title>
        <Body soft>Les prochaines cartes arriveront au bon moment.</Body>
        <Button label="Revenir aux paquets" onPress={() => router.back()} />
      </SafeAreaView>
    );

  const rotateFront = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const rotateBack = flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const tilt = pan.interpolate({ inputRange: [-300, 0, 300], outputRange: ['-10deg', '0deg', '10deg'] });
  const face = { position: 'absolute' as const, inset: 0, backfaceVisibility: 'hidden' as const, borderRadius: 28, borderWidth: 1, borderColor: c.trait, backgroundColor: '#141415', padding: 28, justifyContent: 'center' as const, gap: 16 };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: c.fond, padding: 20, gap: 20 }}>
      <View style={{ alignItems: 'center' }}>
        <Overline>
          {item.deckTitle} · {queue.length} restante{queue.length > 1 ? 's' : ''}
        </Overline>
      </View>
      <Animated.View {...responder.panHandlers} style={{ flex: 1, maxHeight: 520, transform: [{ translateX: pan }, { rotate: tilt }] }}>
        <Pressable accessibilityRole="button" accessibilityLabel={revealed ? 'Réponse' : 'Retourner la carte'} onPress={() => !revealed && reveal()} style={{ flex: 1 }}>
          <Animated.View style={[face, { transform: [{ perspective: 1200 }, { rotateY: rotateFront }] }]}>
            <Overline>Question</Overline>
            <CardText item={item} side="question" />
          </Animated.View>
          <Animated.View style={[face, { transform: [{ perspective: 1200 }, { rotateY: rotateBack }] }]}>
            <Overline>Réponse</Overline>
            <CardText item={item} side="reponse" />
          </Animated.View>
        </Pressable>
      </Animated.View>
      {revealed ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {RATINGS.map((r) => (
            <Pressable
              key={r.value}
              accessibilityRole="button"
              onPress={() => rate(r.value)}
              style={({ pressed }) => ({ flex: 1, minHeight: 64, borderRadius: 20, borderWidth: 1, borderColor: c.trait, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', gap: 2, transform: [{ scale: pressed ? 0.96 : 1 }] })}>
              <Text style={{ fontFamily: fonts.texteMoyen, fontSize: 14, color: TONES[r.value] }}>{r.label}</Text>
              <Text style={{ fontFamily: fonts.texte, fontSize: 11, color: c.doux }}>{delays?.[r.value]}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Button label="Voir la réponse" ghost onPress={reveal} />
      )}
      <Text style={{ textAlign: 'center', fontFamily: fonts.texte, fontSize: 12, color: c.doux }}>
        {revealed ? 'Glisse à droite si tu savais, à gauche sinon.' : 'Touche la carte pour la retourner.'}
      </Text>
      <ErrorText>{error}</ErrorText>
    </SafeAreaView>
  );
}

function CardText({ item, side }: { item: StudyItem; side: 'question' | 'reponse' }) {
  const c = useColors();
  const big = { fontFamily: fonts.titre, fontSize: 28, lineHeight: 36, color: c.texte, textAlign: 'center' as const };
  const card = item.card;
  if (card.kind === 'trous')
    return (
      <>
        <Text style={big}>
          {renderCloze(card.front, item.variant, side).map((s, i) => (
            <Text key={i} style={s.hole ? { color: c.champagne, backgroundColor: 'rgba(230,200,145,0.15)' } : undefined}>
              {s.text}
            </Text>
          ))}
        </Text>
        {side === 'reponse' && card.back ? <Body soft style={{ textAlign: 'center' }}>{card.back}</Body> : null}
      </>
    );
  const reversed = card.kind === 'inversee' && item.variant === 1;
  const q = reversed ? card.back : card.front;
  const a = reversed ? card.front : card.back;
  return side === 'question' ? (
    <Text style={big}>{q}</Text>
  ) : (
    <>
      <Body soft style={{ textAlign: 'center' }}>{q}</Body>
      <Text style={big}>{a}</Text>
    </>
  );
}
