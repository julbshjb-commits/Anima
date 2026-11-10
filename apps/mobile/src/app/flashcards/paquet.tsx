import { CARD_KINDS, cardFace, clozeNumbers, coverOf, dayBounds, daysUntil, examLabel, formatDeckCode, variantsFor, type CardKind } from '@anima/core';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Share, Text, TextInput, View } from 'react-native';

import { Body, Button, Card, ErrorText, Loading, Overline, Title } from '@/components/ui';
import { addCard, deleteCard, loadDeck, pullDeck, shareDeck, type DeckCard } from '@/lib/flashcards';
import { useLoad } from '@/lib/useLoad';
import { fonts, useColors } from '@/theme';

const KINDS = Object.keys(CARD_KINDS) as CardKind[];

/** Un paquet : réviser, ajouter des cartes, partager avec sa promo. */
export default function Paquet() {
  const c = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, refreshing, refresh, reload } = useLoad(useCallback(() => loadDeck(id), [id]));
  const [actionError, setActionError] = useState<string>();
  const [busy, setBusy] = useState<'pull' | 'share' | null>(null);

  if (data === undefined && !error) return <Loading />;
  if (data === null)
    return (
      <View style={{ flex: 1, backgroundColor: c.fond, padding: 24, gap: 16 }}>
        <Body soft>Ce paquet n’existe plus.</Body>
        <Button label="Revenir aux paquets" ghost onPress={() => router.back()} />
      </View>
    );

  const deck = data?.deck;
  const exam = deck?.exam_date ? daysUntil(deck.exam_date, dayBounds().day) : null;

  async function run(kind: 'pull' | 'share', task: () => Promise<unknown>) {
    setBusy(kind);
    setActionError(undefined);
    try {
      await task();
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Ça n’a pas marché. Réessaie.');
    } finally {
      setBusy(null);
    }
  }

  function sendCode(code: string) {
    Share.share({ message: `Ajoute mon paquet de flashcards « ${deck?.title ?? ''} » dans Anima avec le code ${formatDeckCode(code)}.` });
  }

  function stopSharing() {
    Alert.alert('Arrêter le partage ?', 'Le code ne marchera plus. Ceux qui ont déjà ajouté le paquet gardent leur copie.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Arrêter', style: 'destructive', onPress: () => run('share', () => shareDeck(id, false)) },
    ]);
  }

  return (
    <>
      <Stack.Screen options={{ title: deck?.subject ?? '' }} />
      <ScrollView
        style={{ backgroundColor: c.fond }}
        contentContainerStyle={{ padding: 20, gap: 22, maxWidth: 640, width: '100%', alignSelf: 'center' }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <ErrorText>{error}</ErrorText>
        {deck && data ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16 }}>
              <View style={{ width: 48, height: 64, borderRadius: 8, backgroundColor: coverOf(deck.cover).bg }} />
              <View style={{ flex: 1, gap: 4 }}>
                <Title size={32}>{deck.title}</Title>
                <Text style={{ fontFamily: fonts.texte, fontSize: 13, color: c.doux }}>
                  {deck.total} carte{deck.total > 1 ? 's' : ''}
                  {deck.source_deck_id ? ' · ajouté avec un code' : ''}
                </Text>
                {exam != null && exam >= 0 ? (
                  <Text style={{ fontFamily: fonts.texteMoyen, fontSize: 13, color: c.champagne }}>Examen {examLabel(exam)}</Text>
                ) : null}
              </View>
            </View>

            {data.due > 0 && (
              <Button label={`Réviser (${data.due})`} onPress={() => router.push({ pathname: '/flashcards/reviser', params: { paquet: id } })} />
            )}

            {data.updates > 0 && (
              <Card style={{ gap: 12, borderColor: 'rgba(230,200,145,0.3)' }}>
                <Body>
                  L’auteur a ajouté {data.updates} carte{data.updates > 1 ? 's' : ''} depuis ta copie.
                </Body>
                <Button label="Les récupérer" ghost busy={busy === 'pull'} onPress={() => run('pull', () => pullDeck(id))} />
              </Card>
            )}

            {data.toCheck > 0 && (
              <Body soft>
                {data.toCheck} carte{data.toCheck > 1 ? 's' : ''} proposée{data.toCheck > 1 ? 's' : ''} par un assistant IA {data.toCheck > 1 ? 'attendent' : 'attend'} ta relecture sur le
                site.
              </Body>
            )}

            <NewCard deckId={id} onAdded={reload} />

            <Card style={{ gap: 12 }}>
              <Overline>Partager avec ta promo</Overline>
              {deck.share_code ? (
                <>
                  <Text selectable style={{ fontFamily: fonts.titre, fontSize: 34, letterSpacing: 4, color: c.champagne }}>
                    {formatDeckCode(deck.share_code)}
                  </Text>
                  <Body soft>Tes camarades tapent ce code dans Anima, avec « Avec un code ». Tes réponses et tes progrès restent privés.</Body>
                  <Button label="Envoyer le code" onPress={() => sendCode(deck.share_code!)} />
                  <Pressable accessibilityRole="button" onPress={stopSharing} hitSlop={8}>
                    <Text style={{ fontFamily: fonts.texteMoyen, fontSize: 14, color: c.terre }}>Arrêter le partage</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Body soft>Donne un code à ta promo : chacun ajoute sa propre copie et révise à son rythme. Personne ne voit tes réponses.</Body>
                  <Button label="Créer un code de partage" ghost busy={busy === 'share'} onPress={() => run('share', () => shareDeck(id, true))} />
                </>
              )}
            </Card>
            <ErrorText>{actionError}</ErrorText>

            <View style={{ gap: 10 }}>
              <Overline>Cartes du paquet</Overline>
              {data.cards.length === 0 ? <Body soft>Pas encore de carte : ajoute la première juste au-dessus.</Body> : null}
              {data.cards.map((card) => (
                <CardRow key={card.id} card={card} onDeleted={reload} />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

/** Ajout d'une carte : question et réponse, dans les deux sens, ou texte à trous. */
function NewCard({ deckId, onAdded }: { deckId: string; onAdded: () => Promise<void> }) {
  const c = useColors();
  const [kind, setKind] = useState<CardKind>('basique');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [sel, setSel] = useState({ start: 0, end: 0 });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(0);

  // Entoure la sélection d'un trou {{cN::…}} (le numéro suit les trous existants).
  function makeHole() {
    const nums = clozeNumbers(front);
    const n = (nums.length ? Math.max(...nums) : 0) + 1;
    const picked = front.slice(sel.start, sel.end) || 'réponse';
    setFront(`${front.slice(0, sel.start)}{{c${n}::${picked}}}${front.slice(sel.end)}`);
  }

  async function add() {
    setBusy(true);
    setError(undefined);
    try {
      await addCard(deckId, { kind, front, back });
      setFront('');
      setBack('');
      setAdded((n) => n + 1);
      await onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'La carte n’a pas pu être ajoutée.');
    } finally {
      setBusy(false);
    }
  }

  const input = {
    minHeight: 76,
    borderWidth: 1,
    borderRadius: 18,
    borderColor: c.trait,
    backgroundColor: c.surface2,
    color: c.texte,
    fontFamily: fonts.texte,
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'top' as const,
  };
  const label = { fontFamily: fonts.texteMoyen, fontSize: 13, color: c.texte };

  return (
    <Card style={{ gap: 12 }}>
      <Overline>Nouvelle carte</Overline>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {KINDS.map((k) => (
          <Pressable
            key={k}
            accessibilityRole="radio"
            accessibilityState={{ checked: kind === k }}
            onPress={() => setKind(k)}
            style={{
              minHeight: 36,
              paddingHorizontal: 14,
              borderRadius: 999,
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: kind === k ? c.champagne : c.trait,
              backgroundColor: kind === k ? c.champagne : 'transparent',
            }}>
            <Text style={{ fontFamily: kind === k ? fonts.texteGras : fonts.texte, fontSize: 13, color: kind === k ? c.accentTexte : c.texte }}>{CARD_KINDS[k].label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={{ fontFamily: fonts.texte, fontSize: 12, lineHeight: 17, color: c.doux }}>{CARD_KINDS[kind].hint}</Text>
      <Text style={label}>{kind === 'trous' ? 'Texte avec ses trous' : kind === 'inversee' ? 'Recto (terme)' : 'Question'}</Text>
      <TextInput
        accessibilityLabel="Question"
        value={front}
        onChangeText={setFront}
        onSelectionChange={(e) => setSel(e.nativeEvent.selection)}
        multiline
        maxLength={2000}
        placeholder={kind === 'trous' ? 'Le nœud sinusal se trouve dans l’oreillette droite.' : kind === 'inversee' ? 'Systole' : 'Quelle valve sépare l’oreillette gauche du ventricule gauche ?'}
        placeholderTextColor={c.doux}
        style={input}
      />
      {kind === 'trous' && (
        <Pressable accessibilityRole="button" onPress={makeHole} style={{ alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(230,200,145,0.45)', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.texteMoyen, fontSize: 13, color: c.champagne }}>Faire un trou avec la sélection</Text>
        </Pressable>
      )}
      <Text style={label}>{kind === 'trous' ? 'Contexte au verso (facultatif)' : kind === 'inversee' ? 'Verso (définition, traduction)' : 'Réponse'}</Text>
      <TextInput
        accessibilityLabel="Réponse"
        value={back}
        onChangeText={setBack}
        multiline
        maxLength={4000}
        placeholder={kind === 'inversee' ? 'Contraction des ventricules' : kind === 'trous' ? '' : 'La valve mitrale'}
        placeholderTextColor={c.doux}
        style={input}
      />
      <ErrorText>{error}</ErrorText>
      <Button label="Ajouter la carte" onPress={add} busy={busy} disabled={!front.trim()} />
      {added > 0 && !error ? (
        <Text style={{ fontFamily: fonts.texte, fontSize: 13, color: c.champagne }}>
          {added} carte{added > 1 ? 's' : ''} ajoutée{added > 1 ? 's' : ''}. Elle{added > 1 ? 's' : ''} entre{added > 1 ? 'nt' : ''} en révision.
        </Text>
      ) : null}
    </Card>
  );
}

function CardRow({ card, onDeleted }: { card: DeckCard; onDeleted: () => Promise<void> }) {
  const c = useColors();
  const v = variantsFor(card.kind, card.front)[0] ?? 0;
  function remove() {
    Alert.alert('Supprimer cette carte ?', 'Ses progrès seront perdus.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCard(card.id);
            await onDeleted();
          } catch {
            Alert.alert('La carte n’a pas pu être supprimée.');
          }
        },
      },
    ]);
  }
  return (
    <Card style={{ gap: 6, padding: 16 }}>
      <Body>{cardFace(card, v, 'question')}</Body>
      <Text style={{ fontFamily: fonts.texte, fontSize: 13, lineHeight: 19, color: c.champagne }}>{cardFace(card, v, 'reponse')}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <Text style={{ fontFamily: fonts.texte, fontSize: 11, color: c.doux }}>{CARD_KINDS[card.kind].short}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Supprimer la carte" onPress={remove} hitSlop={10}>
          <Text style={{ fontFamily: fonts.texteMoyen, fontSize: 13, color: c.doux }}>Supprimer</Text>
        </Pressable>
      </View>
    </Card>
  );
}
