import { cardFace, coverOf, formatDeckCode, variantsFor, type DeckPreview } from '@anima/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Body, Button, Card, ErrorText, Field, Overline, Screen, Title } from '@/components/ui';
import { importDeck, previewDeck } from '@/lib/flashcards';
import { fonts, useColors } from '@/theme';

/** Paquet partagé par un camarade : on le regarde, puis on ajoute sa propre copie. */
export default function AjouterAvecCode() {
  const c = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(params.code ? formatDeckCode(params.code) : '');
  const [found, setFound] = useState<{ code: string; preview: DeckPreview }>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function look() {
    setBusy(true);
    setError(undefined);
    try {
      setFound(await previewDeck(code));
    } catch (e) {
      setFound(undefined);
      setError(e instanceof Error ? e.message : 'Ce code ne fonctionne pas.');
    } finally {
      setBusy(false);
    }
  }

  // Code reçu par un lien : on montre directement le paquet.
  useEffect(() => {
    if (!params.code) return;
    let alive = true;
    previewDeck(params.code)
      .then((r) => alive && setFound(r))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Ce code ne fonctionne pas.'));
    return () => {
      alive = false;
    };
  }, [params.code]);

  async function add() {
    if (!found) return;
    setBusy(true);
    setError(undefined);
    try {
      const id = await importDeck(found.code);
      router.dismissTo({ pathname: '/flashcards/paquet', params: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Le paquet n’a pas pu être ajouté.');
      setBusy(false);
    }
  }

  const p = found?.preview;
  return (
    <Screen>
      <Title>Le paquet d’un camarade</Title>
      <Body soft>Tu reçois ta propre copie : tes réponses et tes progrès restent à toi, et tu pourras récupérer les cartes que l’auteur ajoutera ensuite.</Body>
      <Field
        label="Code du paquet"
        value={code}
        onChangeText={(v) => {
          setCode(v);
          setFound(undefined);
        }}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="K7MQ-2PXA"
        maxLength={10}
        autoFocus={!params.code}
        onSubmitEditing={() => look()}
        style={{ fontSize: 22, letterSpacing: 4 }}
      />
      <ErrorText>{error}</ErrorText>
      {!p ? (
        <Button label="Voir le paquet" onPress={() => look()} busy={busy} disabled={!code.trim()} />
      ) : (
        <>
          <Card style={{ gap: 12, backgroundColor: '#141415', borderColor: 'rgba(230,200,145,0.3)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 40, height: 54, borderRadius: 7, backgroundColor: coverOf(p.cover).bg }} />
              <View style={{ flex: 1, gap: 3 }}>
                {p.subject ? <Overline>{p.subject}</Overline> : null}
                <Title size={26}>{p.title}</Title>
                <Text style={{ fontFamily: fonts.texte, fontSize: 13, color: c.doux }}>
                  Partagé par {p.author} · {p.cards} carte{p.cards > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
            {p.description ? <Body soft>{p.description}</Body> : null}
          </Card>
          {p.sample.map((s, i) => {
            const v = variantsFor(s.kind, s.front)[0] ?? 0;
            return (
              <Card key={i} style={{ gap: 6 }}>
                <Body>{cardFace(s, v, 'question')}</Body>
                <Text style={{ fontFamily: fonts.texte, fontSize: 13, lineHeight: 19, color: c.champagne }}>{cardFace(s, v, 'reponse')}</Text>
              </Card>
            );
          })}
          {p.mine ? (
            <Body soft>C’est ton paquet. Donne ce code à ta promo pour qu’elle l’ajoute.</Body>
          ) : (
            <Button label={p.copied ? 'Ouvrir ma copie et récupérer les nouveautés' : 'Ajouter à mes paquets'} onPress={add} busy={busy} />
          )}
        </>
      )}
    </Screen>
  );
}
