import { MOOD_META, MOODS, type Mood, type PublicPostSource } from '@anima/core';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Body, Button, ErrorText, Field, Loading, Overline } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import { getEntry, getJournal } from '@/lib/data';
import { createPost, getMe, type Picture } from '@/lib/reseau';
import { fonts, useColors } from '@/theme';

/** Écrire une publication : une pensée, une citation, une photo. Peut partir d'une page de journal partagé. */
export default function Publier() {
  const c = useColors();
  const router = useRouter();
  const userId = useUserId();
  const { journal, entree } = useLocalSearchParams<{ journal?: string; entree?: string }>();
  const [ready, setReady] = useState(false);
  const [source, setSource] = useState<PublicPostSource>('libre');
  const [body, setBody] = useState('');
  const [quoteBy, setQuoteBy] = useState('');
  const [mood, setMood] = useState<Mood | null>(null);
  const [photo, setPhoto] = useState<Picture | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // Depuis une page de journal : on reprend le texte, jamais celui d'un journal intime.
  useEffect(() => {
    (async () => {
      try {
        // Pas encore de profil public : on le crée d'abord.
        if (!(await getMe(userId))) return router.replace('/decouvrir/profil');
        if (!journal || !entree) return;
        const [j, e] = await Promise.all([getJournal(journal, userId), getEntry(journal, entree)]);
        if (j && e && j.journal.kind !== 'intime' && e.author_id === userId) {
          setBody(e.content_text.slice(0, 2000));
          setMood(e.mood);
          setSource('journal');
        }
      } catch {
        // Hors ligne : on laisse écrire, l'envoi dira ce qui ne va pas.
      } finally {
        setReady(true);
      }
    })();
  }, [journal, entree, userId, router]);

  if (!ready) return <Loading />;
  const citation = source === 'citation';

  async function pick() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    setError(undefined);
    setPhoto({ uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg', size: a.fileSize ?? 0 });
  }

  async function send() {
    setError(undefined);
    setBusy(true);
    try {
      await createPost(userId, { body, mood, source, quoteBy, photo: citation ? null : photo });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'La publication n’a pas pu être envoyée.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.fond }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 22, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 8 }}>
          {(
            [
              [source === 'journal' ? 'journal' : 'libre', source === 'journal' ? 'Page de journal' : 'Pensée'],
              ['citation', 'Citation'],
            ] as [PublicPostSource, string][]
          ).map(([id, label]) => {
            const on = source === id;
            return (
              <Pressable
                key={id}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => setSource(id)}
                style={{ height: 38, paddingHorizontal: 16, borderRadius: 19, justifyContent: 'center', backgroundColor: on ? c.surface2 : 'transparent', borderWidth: 1, borderColor: on ? 'rgba(230,200,145,0.35)' : c.trait }}>
                <Text style={{ fontFamily: fonts.texteMoyen, fontSize: 14, color: on ? c.champagne : c.doux }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: 6 }}>
          <TextInput
            value={body}
            onChangeText={setBody}
            multiline
            autoFocus={!entree}
            maxLength={2000}
            placeholder={citation ? 'La phrase qui t’a marqué·e' : 'Qu’est-ce que tu veux partager ?'}
            placeholderTextColor={c.doux}
            accessibilityLabel={citation ? 'Citation' : 'Ta publication'}
            textAlignVertical="top"
            style={{
              minHeight: 170,
              fontFamily: citation ? fonts.titreItalique : fonts.texte,
              fontSize: citation ? 22 : 17,
              lineHeight: citation ? 30 : 26,
              color: c.texte,
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.trait,
              borderRadius: 18,
              padding: 16,
            }}
          />
          <Body soft style={{ fontSize: 12, textAlign: 'right' }}>{`${body.length} / 2 000`}</Body>
        </View>

        {citation ? <Field label="De qui ?" value={quoteBy} onChangeText={setQuoteBy} maxLength={120} placeholder="Auteur, livre, film…" /> : null}

        <View style={{ gap: 10 }}>
          <Overline>Humeur (facultatif)</Overline>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {MOODS.map((m) => {
              const on = mood === m;
              return (
                <Pressable
                  key={m}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => setMood(on ? null : m)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, paddingLeft: 8, paddingRight: 14, borderRadius: 19, borderWidth: 1, borderColor: on ? c.texte : c.trait, backgroundColor: on ? c.surface : 'transparent' }}>
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: MOOD_META[m].color }} />
                  <Text style={{ fontFamily: fonts.texte, fontSize: 14, color: c.texte }}>{MOOD_META[m].label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {!citation ? (
          <View style={{ gap: 10 }}>
            {photo ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Retirer la photo" onPress={() => setPhoto(null)} style={{ alignSelf: 'flex-start' }}>
                <Image source={{ uri: photo.uri }} contentFit="cover" style={{ width: 140, height: 175, borderRadius: 12 }} />
                <Text style={{ fontFamily: fonts.texte, fontSize: 13, color: c.doux, marginTop: 6 }}>Touche la photo pour la retirer.</Text>
              </Pressable>
            ) : (
              <Button label="Ajouter une photo" ghost onPress={pick} disabled={busy} />
            )}
          </View>
        ) : null}

        <Body soft style={{ fontSize: 13 }}>
          Ta publication sera visible sur le réseau Anima. Tu pourras la supprimer à tout moment.
        </Body>
        <ErrorText>{error}</ErrorText>
        <Button label="Publier" onPress={send} busy={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
