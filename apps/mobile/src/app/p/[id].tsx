import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthorRow, ContentMenu, PostCard, relativeTime } from '@/components/social';
import { Body, Button, ErrorText, Loading, Overline, Title } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import { addComment, getPost } from '@/lib/reseau';
import { useLoad } from '@/lib/useLoad';
import { fonts, useColors } from '@/theme';

/** Une publication et ses commentaires. */
export default function PublicationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const router = useRouter();
  const userId = useUserId();
  const insets = useSafeAreaInsets();
  const { data, error, refreshing, refresh, reload } = useLoad(useCallback(() => getPost(userId, id), [userId, id]));
  const [text, setText] = useState('');
  const [sendError, setSendError] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (data === undefined && !error) return <Loading />;
  if (data === null) {
    return (
      <View style={{ flex: 1, padding: 24, gap: 12, backgroundColor: c.fond }}>
        <Title>Publication introuvable</Title>
        <Body soft>Elle a été supprimée, ou n’est pas visible pour toi.</Body>
      </View>
    );
  }

  async function send() {
    setSendError(undefined);
    setBusy(true);
    try {
      await addComment(id, text);
      setText('');
      await reload();
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Le commentaire n’a pas pu être envoyé.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90} style={{ flex: 1, backgroundColor: c.fond }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 18, maxWidth: 640, width: '100%', alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <ErrorText>{error}</ErrorText>
        {data ? (
          <>
            <PostCard post={data.post} detail onChanged={() => router.back()} />
            <Overline>{data.comments.length ? `${data.comments.length} commentaire${data.comments.length > 1 ? 's' : ''}` : 'Commentaires'}</Overline>
            {data.comments.length ? (
              data.comments.map((cm) => (
                <View key={cm.id} style={{ gap: 6 }}>
                  <AuthorRow
                    author={cm.author}
                    size={32}
                    sub={relativeTime(cm.created_at)}
                    right={<ContentMenu target={{ kind: 'comment', id: cm.id }} author={cm.author} onChanged={reload} />}
                  />
                  <Text style={{ fontFamily: fonts.texte, fontSize: 15.5, lineHeight: 23, color: cm.hidden_at ? c.doux : c.texte, marginLeft: 44 }}>
                    {cm.body}
                    {cm.hidden_at ? '  (masqué après des signalements)' : ''}
                  </Text>
                </View>
              ))
            ) : (
              <Body soft>Sois la première personne à répondre.</Body>
            )}
          </>
        ) : null}
      </ScrollView>
      {data && !data.post.hidden_at ? (
        <View style={{ borderTopWidth: 1, borderColor: c.trait, backgroundColor: c.fond, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 + insets.bottom, gap: 8 }}>
          <ErrorText>{sendError}</ErrorText>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              maxLength={500}
              placeholder="Ajouter un commentaire"
              placeholderTextColor={c.doux}
              accessibilityLabel="Ton commentaire"
              style={{ flex: 1, minHeight: 46, maxHeight: 120, borderWidth: 1, borderColor: c.trait, borderRadius: 23, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 16, fontFamily: fonts.texte, color: c.texte, backgroundColor: c.surface }}
            />
            <Button label="Envoyer" onPress={send} busy={busy} disabled={!text.trim()} style={{ minHeight: 46, paddingHorizontal: 18 }} />
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
