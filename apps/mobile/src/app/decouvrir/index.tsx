import { Link, Stack, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PostCard } from '@/components/social';
import { Body, Button, Card, ErrorText, Loading, Overline, Title } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import { getFeed, loadDiscover, type FeedPost, type FeedTab } from '@/lib/reseau';
import { useLoad } from '@/lib/useLoad';
import { fonts, useColors } from '@/theme';

const TABS: { id: FeedTab; label: string }[] = [
  { id: 'pour-toi', label: 'Pour toi' },
  { id: 'abonnements', label: 'Abonnements' },
];

/** Le fil du réseau public. Sans profil public, on explique d'abord ce que c'est. */
export default function Decouvrir() {
  const c = useColors();
  const router = useRouter();
  const userId = useUserId();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<FeedTab>('pour-toi');
  const { data, error, refreshing, refresh, reload } = useLoad(useCallback(() => loadDiscover(userId, tab), [userId, tab]));
  // Pages suivantes, rattachées à la première publication du fil pour s'effacer quand il change.
  const [more, setMore] = useState<{ key: string; posts: FeedPost[]; done: boolean }>();
  const [loadingMore, setLoadingMore] = useState(false);

  if (!data && !error) return <Loading />;
  if (data && !data.me) return <Bienvenue />;

  const first = data?.posts ?? [];
  const key = `${tab}:${first[0]?.id ?? ''}`;
  const extra = more?.key === key ? more : undefined;
  const posts = [...first, ...(extra?.posts ?? [])];
  const canLoadMore = first.length === 30 && !extra?.done;

  async function loadMore() {
    const last = posts[posts.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await getFeed(userId, tab, last.created_at);
      setMore({ key, posts: [...(extra?.posts ?? []), ...next], done: next.length < 30 });
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.fond }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, paddingRight: 4 }}>
              <HeaderLink href="/decouvrir/recherche" label="Chercher" />
              <HeaderLink href="/decouvrir/notifications" label="Notifs" dot={!!data?.unread} />
            </View>
          ),
        }}
      />
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 + insets.bottom, gap: 16, maxWidth: 640, width: '100%', alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <View style={{ gap: 16 }}>
            {data?.me ? (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Mon profil public"
                onPress={() => router.push({ pathname: '/u/[handle]', params: { handle: data.me!.handle } })}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Title size={36}>
                  Découvrir{' '}
                  <Text style={{ fontFamily: fonts.titreItalique, color: c.champagne }}>@{data.me.handle}</Text>
                </Title>
              </Pressable>
            ) : null}
            <ErrorText>{error}</ErrorText>
            <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 8 }}>
              {TABS.map((t) => {
                const on = t.id === tab;
                return (
                  <Pressable
                    key={t.id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    onPress={() => setTab(t.id)}
                    style={{ height: 38, paddingHorizontal: 16, borderRadius: 19, justifyContent: 'center', backgroundColor: on ? c.surface2 : 'transparent', borderWidth: 1, borderColor: on ? 'rgba(230,200,145,0.35)' : c.trait }}>
                    <Text style={{ fontFamily: fonts.texteMoyen, fontSize: 14, color: on ? c.champagne : c.doux }}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        renderItem={({ item, index }) => <PostCard post={item} index={index} onChanged={reload} />}
        ListEmptyComponent={
          <Card style={{ gap: 10 }}>
            <Title size={26}>{tab === 'abonnements' ? 'Ton fil est encore calme' : 'Rien pour l’instant'}</Title>
            <Body soft>
              {tab === 'abonnements'
                ? 'Suis quelques personnes pour voir ici ce qu’elles publient.'
                : 'Sois la première personne à publier une pensée, une citation ou une photo.'}
            </Body>
            {tab === 'abonnements' ? <Button label="Trouver des personnes" ghost onPress={() => router.push('/decouvrir/recherche')} /> : null}
          </Card>
        }
        ListFooterComponent={canLoadMore ? <Button label="Voir plus" ghost busy={loadingMore} onPress={loadMore} /> : undefined}
      />
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 20 + insets.bottom, alignItems: 'center' }}>
        <Button label="Publier" onPress={() => router.push('/decouvrir/publier')} style={{ paddingHorizontal: 36 }} />
      </View>
    </View>
  );
}

function HeaderLink({ href, label, dot }: { href: '/decouvrir/recherche' | '/decouvrir/notifications'; label: string; dot?: boolean }) {
  const c = useColors();
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={dot ? `${label}, du nouveau` : label} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Text style={{ fontFamily: fonts.texteMoyen, color: c.texte }}>{label}</Text>
        {dot ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.champagne }} /> : null}
      </Pressable>
    </Link>
  );
}

/** Première visite : ce qu'est le réseau, et ce qui reste privé. */
function Bienvenue() {
  const c = useColors();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: c.fond, padding: 20, justifyContent: 'center' }}>
      <Card style={{ gap: 16, backgroundColor: '#141415', borderColor: 'rgba(230,200,145,0.25)', maxWidth: 640, width: '100%', alignSelf: 'center' }}>
        <Overline>Le réseau Anima</Overline>
        <Title size={36}>
          Partage ce qui compte, <Text style={{ fontFamily: fonts.titreItalique, color: c.champagne }}>si tu veux.</Text>
        </Title>
        <Body soft>
          Un fil ouvert à tout le monde : pensées, citations, photos. Tu choisis un pseudo, tu suis qui tu veux, et tu peux repartir à tout moment.
        </Body>
        <Body soft>Tes journaux, tes notes et tes cartes restent privés. Rien n’est publié sans que tu appuies sur « Publier ».</Body>
        <Button label="Créer mon profil public" onPress={() => router.push('/decouvrir/profil')} />
      </Card>
    </View>
  );
}
