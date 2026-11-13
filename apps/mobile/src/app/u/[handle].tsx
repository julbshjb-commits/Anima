import { compactCount } from '@anima/core';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { FollowButton, PostCard, ProfilePic } from '@/components/social';
import { Body, Button, Card, ErrorText, Loading, Title } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import { block, getProfile, unblock } from '@/lib/reseau';
import { useLoad } from '@/lib/useLoad';
import { fonts, useColors } from '@/theme';

/** Un profil public : le mien ou celui de quelqu'un d'autre. */
export default function ProfilScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const c = useColors();
  const router = useRouter();
  const userId = useUserId();
  const { data, error, refreshing, refresh, reload } = useLoad(useCallback(() => getProfile(userId, handle), [userId, handle]));

  if (data === undefined && !error) return <Loading />;
  if (data === null) {
    return (
      <View style={{ flex: 1, padding: 24, gap: 12, backgroundColor: c.fond }}>
        <Stack.Screen options={{ title: '' }} />
        <Title>Profil introuvable</Title>
        <Body soft>Ce profil n’existe pas, ou n’est pas visible pour toi.</Body>
      </View>
    );
  }
  const p = data?.profile;

  function more() {
    if (!p || !data) return;
    Alert.alert(`@${p.handle}`, undefined, [
      { text: 'Signaler ce profil', onPress: () => router.push({ pathname: '/signaler', params: { kind: 'profile', id: p.id, authorId: p.id, handle: p.handle } }) },
      data.relation.blocked
        ? { text: 'Débloquer', onPress: () => unblock(userId, p.id).then(reload) }
        : {
            text: `Bloquer @${p.handle}`,
            style: 'destructive',
            onPress: () =>
              Alert.alert(`Bloquer @${p.handle} ?`, 'Vous ne verrez plus rien l’un de l’autre, et vos abonnements sont retirés.', [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Bloquer', style: 'destructive', onPress: () => block(p.id).then(reload, () => Alert.alert('Blocage impossible', 'Réessaie.')) },
              ]),
          },
      { text: 'Annuler', style: 'cancel' },
    ]);
  }

  return (
    <ScrollView
      style={{ backgroundColor: c.fond }}
      contentContainerStyle={{ padding: 16, gap: 18, maxWidth: 640, width: '100%', alignSelf: 'center' }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <Stack.Screen
        options={{
          title: p ? `@${p.handle}` : '',
          headerRight: () =>
            p && !data?.isMe ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Plus d’options" hitSlop={12} onPress={more}>
                <Text style={{ fontSize: 22, color: c.texte }}>⋯</Text>
              </Pressable>
            ) : null,
        }}
      />
      <ErrorText>{error}</ErrorText>
      {p && data ? (
        <>
          <View style={{ alignItems: 'center', gap: 12, paddingTop: 8 }}>
            <ProfilePic name={p.name} src={p.avatar} size={96} />
            <View style={{ alignItems: 'center', gap: 2 }}>
              <Title size={32} style={{ textAlign: 'center' }}>
                {p.name}
              </Title>
              <Text style={{ fontFamily: fonts.texte, fontSize: 14, color: c.doux }}>
                @{p.handle}
                {p.is_private ? ' · compte privé' : ''}
                {data.relation.followsMe ? ' · te suit' : ''}
              </Text>
            </View>
            {p.bio ? <Body style={{ textAlign: 'center', maxWidth: 420 }}>{p.bio}</Body> : null}
            {p.suspended_at ? <Body style={{ color: c.terre, textAlign: 'center' }}>Ce compte est suspendu par l’équipe Anima.</Body> : null}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 28 }}>
            <Stat n={p.posts_count} label={p.posts_count > 1 ? 'publications' : 'publication'} />
            <Stat n={p.followers_count} label={p.followers_count > 1 ? 'abonnés' : 'abonné'} />
            <Stat n={p.following_count} label={p.following_count > 1 ? 'abonnements' : 'abonnement'} />
          </View>

          <View style={{ alignItems: 'center' }}>
            {data.isMe ? (
              <Button label="Modifier mon profil" ghost onPress={() => router.push('/decouvrir/profil')} />
            ) : data.relation.blocked ? (
              <Button label="Débloquer" ghost onPress={() => unblock(userId, p.id).then(reload)} />
            ) : !data.hasProfile ? (
              <Button label="Créer mon profil pour suivre" onPress={() => router.push('/decouvrir/profil')} />
            ) : (
              <FollowButton id={p.id} relation={data.relation} onChanged={reload} />
            )}
          </View>

          {data.relation.blocked ? (
            <Card>
              <Body soft>Tu as bloqué ce profil : vous ne voyez plus rien l’un de l’autre.</Body>
            </Card>
          ) : !data.canSeePosts ? (
            <Card style={{ gap: 6 }}>
              <Title size={24}>Compte privé</Title>
              <Body soft>
                {data.relation.following === 'pending' ? 'Ta demande est envoyée. Tu verras ses publications quand elle sera acceptée.' : 'Abonne-toi pour demander à voir ses publications.'}
              </Body>
            </Card>
          ) : data.posts.length ? (
            data.posts.map((post, i) => <PostCard key={post.id} post={post} index={i} onChanged={reload} />)
          ) : (
            <Body soft style={{ textAlign: 'center' }}>
              {data.isMe ? 'Tu n’as encore rien publié.' : 'Aucune publication pour l’instant.'}
            </Body>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  const c = useColors();
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text style={{ fontFamily: fonts.titre, fontSize: 24, color: c.texte }}>{compactCount(n)}</Text>
      <Text style={{ fontFamily: fonts.texte, fontSize: 12, color: c.doux }}>{label}</Text>
    </View>
  );
}
