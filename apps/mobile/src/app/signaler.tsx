import type { ReportReason } from '@anima/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { REPORT_REASON_LIST } from '@/components/social';
import { Body, Button, ErrorText, Field, Screen, Title } from '@/components/ui';
import { block, report, type ReportTarget } from '@/lib/reseau';
import { fonts, useColors } from '@/theme';

const WHAT: Record<ReportTarget['kind'], string> = { post: 'cette publication', comment: 'ce commentaire', profile: 'ce profil' };

/** Signaler un contenu ou un profil à l'équipe Anima, et bloquer son auteur si on veut. */
export default function Signaler() {
  const { kind, id, authorId, handle } = useLocalSearchParams<{ kind: ReportTarget['kind']; id: string; authorId: string; handle: string }>();
  const c = useColors();
  const router = useRouter();
  const [reason, setReason] = useState<ReportReason>();
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const target: ReportTarget['kind'] = kind === 'comment' || kind === 'profile' ? kind : 'post';

  async function send() {
    if (!reason) return setError('Choisis une raison.');
    setError(undefined);
    setBusy(true);
    try {
      await report({ kind: target, id }, reason, details);
      if (alsoBlock && authorId) await block(authorId);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Le signalement n’a pas pu être envoyé.');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <Screen>
        <Title>Merci</Title>
        <Body soft>
          Ton signalement est envoyé à l’équipe Anima. La personne ne saura pas qu’il vient de toi.
          {alsoBlock ? ` Tu as aussi bloqué @${handle}.` : ''}
        </Body>
        <Button label="Fermer" onPress={() => (alsoBlock ? router.dismissTo('/decouvrir') : router.back())} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title size={30}>Signaler {WHAT[target]}</Title>
      <Body soft>Qu’est-ce qui ne va pas ? Ton signalement reste anonyme pour la personne.</Body>
      <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
        {REPORT_REASON_LIST.map(([key, label]) => {
          const on = reason === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => setReason(key)}
              style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: on ? 'rgba(230,200,145,0.5)' : c.trait, backgroundColor: on ? c.surface2 : 'transparent' }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: on ? c.champagne : c.doux, alignItems: 'center', justifyContent: 'center' }}>
                {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.champagne }} /> : null}
              </View>
              <Text style={{ fontFamily: fonts.texte, fontSize: 15, color: c.texte }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Field label="Un détail à ajouter ? (facultatif)" value={details} onChangeText={setDetails} maxLength={500} multiline style={{ minHeight: 84, paddingTop: 12, textAlignVertical: 'top' }} />
      {authorId ? (
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: alsoBlock }} onPress={() => setAlsoBlock((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 1, borderColor: alsoBlock ? c.champagne : c.doux, backgroundColor: alsoBlock ? c.champagne : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {alsoBlock ? <Text style={{ fontFamily: fonts.texteGras, fontSize: 15, color: c.accentTexte }}>✓</Text> : null}
          </View>
          <Text style={{ flex: 1, fontFamily: fonts.texte, fontSize: 15, color: c.texte }}>Bloquer aussi @{handle}</Text>
        </Pressable>
      ) : null}
      <ErrorText>{error}</ErrorText>
      <Button label="Envoyer le signalement" onPress={send} busy={busy} />
    </Screen>
  );
}
