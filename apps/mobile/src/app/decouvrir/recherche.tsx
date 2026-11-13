import { compactCount } from '@anima/core';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { AuthorRow } from '@/components/social';
import { Body, Card, ErrorText, Overline } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import { searchProfiles } from '@/lib/reseau';
import { useLoad } from '@/lib/useLoad';
import { fonts, useColors } from '@/theme';

/** Chercher une personne par pseudo ou par nom ; sans texte, des profils à découvrir. */
export default function Recherche() {
  const c = useColors();
  const userId = useUserId();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(text), 300);
    return () => clearTimeout(t);
  }, [text]);
  const { data, error } = useLoad(useCallback(() => searchProfiles(userId, q), [userId, q]));
  const searching = q.trim().replace(/^@/, '').length >= 2;

  return (
    <ScrollView style={{ backgroundColor: c.fond }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 20, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
      <TextInput
        value={text}
        onChangeText={setText}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        placeholder="Un pseudo ou un nom"
        placeholderTextColor={c.doux}
        accessibilityLabel="Chercher une personne"
        style={{ minHeight: 48, borderWidth: 1, borderColor: c.trait, borderRadius: 24, paddingHorizontal: 18, fontSize: 16, fontFamily: fonts.texte, color: c.texte, backgroundColor: c.surface }}
      />
      <ErrorText>{error}</ErrorText>
      <Overline>{searching ? 'Résultats' : 'À découvrir'}</Overline>
      {data?.length ? (
        data.map((p) => (
          <Card key={p.id} style={{ gap: 8, padding: 14 }}>
            <AuthorRow author={p} sub={`${compactCount(p.followers_count)} abonné${p.followers_count > 1 ? 's' : ''}`} />
            {p.bio ? (
              <Text numberOfLines={2} style={{ fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: c.doux }}>
                {p.bio}
              </Text>
            ) : null}
          </Card>
        ))
      ) : data ? (
        <Body soft>{searching ? 'Personne ne correspond à cette recherche.' : 'Personne à suggérer pour l’instant.'}</Body>
      ) : null}
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}
