import { formatLongDate, MOOD_META, MOODS, parseIsoDate, toIsoDate, type Mood } from '@anima/core';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Body, Button, ErrorText, Overline } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import { createEntry, MAX_PHOTO_BYTES, MAX_PHOTOS, PHOTO_TYPES, type Photo } from '@/lib/data';
import { fonts, useColors } from '@/theme';

export default function Ecrire() {
  const { id, date: initialDate } = useLocalSearchParams<{ id: string; date?: string }>();
  const userId = useUserId();
  const router = useRouter();
  const c = useColors();
  const [date, setDate] = useState(initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : toIsoDate(new Date()));
  const [mood, setMood] = useState<Mood | null>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState<string>();
  const [step, setStep] = useState<string>();

  function shiftDay(delta: number) {
    const d = parseIsoDate(date);
    d.setDate(d.getDate() + delta);
    setDate(toIsoDate(d));
  }

  async function pickPhotos() {
    const left = MAX_PHOTOS - photos.length;
    if (left <= 0) return setError(`${MAX_PHOTOS} photos maximum par entrée.`);
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: left,
      quality: 0.8,
    });
    if (res.canceled) return;
    const picked: Photo[] = [];
    for (const a of res.assets.slice(0, left)) {
      const mimeType = a.mimeType ?? 'image/jpeg';
      if (!PHOTO_TYPES[mimeType]) return setError('Formats acceptés : JPEG, PNG, WebP, HEIC.');
      if (a.fileSize && a.fileSize > MAX_PHOTO_BYTES) return setError('Chaque photo doit faire moins de 10 Mo.');
      picked.push({ uri: a.uri, mimeType, size: a.fileSize ?? 0 });
    }
    setError(undefined);
    setPhotos((p) => [...p, ...picked]);
  }

  async function save() {
    setError(undefined);
    try {
      const { failedPhotos } = await createEntry(userId, { journalId: id, entryDate: date, title, contentText: text, mood }, photos, setStep);
      if (failedPhotos) {
        Alert.alert('Entrée enregistrée', `${failedPhotos} photo(s) n’ont pas pu être envoyées. Tu pourras réessayer plus tard.`);
      }
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'L’entrée n’a pas pu être enregistrée.');
    } finally {
      setStep(undefined);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.fond }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 22, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <DayArrow label="Jour précédent" glyph="‹" onPress={() => shiftDay(-1)} />
          <Text style={{ fontFamily: fonts.texteMoyen, fontSize: 15, color: c.texte }}>{formatLongDate(date)}</Text>
          <DayArrow label="Jour suivant" glyph="›" onPress={() => shiftDay(1)} />
        </View>

        <View style={{ gap: 10 }}>
          <Overline>Comment te sens-tu ?</Overline>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {MOODS.map((m) => {
              const on = mood === m;
              return (
                <Pressable
                  key={m}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => setMood(on ? null : m)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    height: 40,
                    paddingLeft: 8,
                    paddingRight: 14,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: on ? c.texte : c.trait,
                    backgroundColor: on ? c.surface : 'transparent',
                  }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: MOOD_META[m].color }} />
                  <Text style={{ fontFamily: fonts.texte, fontSize: 14, color: c.texte }}>{MOOD_META[m].label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <TextInput
          value={title}
          onChangeText={setTitle}
          maxLength={120}
          placeholder="Un titre, si tu veux"
          placeholderTextColor={c.doux}
          accessibilityLabel="Titre"
          style={{ fontFamily: fonts.titre, fontSize: 32, color: c.texte, borderBottomWidth: 1, borderColor: c.trait, paddingBottom: 8 }}
        />
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          maxLength={50000}
          placeholder="Qu’est-ce qui a compté aujourd’hui ?"
          placeholderTextColor={c.doux}
          accessibilityLabel="Ton entrée"
          textAlignVertical="top"
          style={{
            minHeight: 220,
            fontFamily: fonts.texte,
            fontSize: 17,
            lineHeight: 26,
            color: c.texte,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.trait,
            borderRadius: 18,
            padding: 16,
          }}
        />

        <View style={{ gap: 10 }}>
          <Overline>{`Photos (${photos.length}/${MAX_PHOTOS})`}</Overline>
          {photos.length ? (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {photos.map((p, i) => (
                <Pressable
                  key={p.uri}
                  accessibilityRole="button"
                  accessibilityLabel={`Retirer la photo ${i + 1}`}
                  onPress={() => setPhotos((all) => all.filter((x) => x.uri !== p.uri))}>
                  <Image source={{ uri: p.uri }} style={{ width: 76, height: 76, borderRadius: 10 }} contentFit="cover" />
                </Pressable>
              ))}
            </View>
          ) : null}
          {photos.length ? <Body soft style={{ fontSize: 13 }}>Touche une photo pour la retirer.</Body> : null}
          {photos.length < MAX_PHOTOS ? <Button label="Ajouter des photos" ghost onPress={pickPhotos} disabled={!!step} /> : null}
        </View>

        <ErrorText>{error}</ErrorText>
        <Button label={step ?? 'Enregistrer l’entrée'} onPress={save} busy={!!step} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function DayArrow({ label, glyph, onPress }: { label: string; glyph: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={10} onPress={onPress} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 26, color: c.texte }}>{glyph}</Text>
    </Pressable>
  );
}
