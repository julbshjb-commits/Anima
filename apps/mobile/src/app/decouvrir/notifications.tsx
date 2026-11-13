import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { AuthorRow, ProfilePic, relativeTime } from '@/components/social';
import { Body, Button, Card, ErrorText, Loading, Overline } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import { acceptFollower, getNotifications, markNotificationsRead, removeFollower, type NotificationRow } from '@/lib/reseau';
import { useLoad } from '@/lib/useLoad';
import { fonts, useColors } from '@/theme';

const TEXT: Record<NotificationRow['kind'], string> = {
  follow: 's’est abonné·e à toi',
  follow_request: 'veut s’abonner à toi',
  follow_accepted: 'a accepté ta demande',
  like: 'a aimé ta publication',
  comment: 'a commenté ta publication',
};

export default function Notifications() {
  const c = useColors();
  const router = useRouter();
  const userId = useUserId();
  const { data, error, refreshing, refresh, reload } = useLoad(useCallback(() => getNotifications(userId), [userId]));
  const [busy, setBusy] = useState<string>();

  // Ouvrir l'écran suffit à tout marquer comme lu (les nouvelles restent surlignées le temps de la visite).
  const loaded = !!data;
  useEffect(() => {
    if (loaded) void markNotificationsRead();
  }, [loaded]);

  if (!data && !error) return <Loading />;

  async function answer(id: string, accept: boolean) {
    setBusy(id);
    try {
      if (accept) await acceptFollower(userId, id);
      else await removeFollower(userId, id);
      await reload();
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: c.fond }}
      contentContainerStyle={{ padding: 20, gap: 14, maxWidth: 640, width: '100%', alignSelf: 'center' }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <ErrorText>{error}</ErrorText>

      {data?.requests.length ? (
        <View style={{ gap: 12, marginBottom: 10 }}>
          <Overline>Demandes d’abonnement</Overline>
          {data.requests.map((a) => (
            <Card key={a.id} style={{ gap: 12, padding: 14 }}>
              <AuthorRow author={a} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button label="Accepter" onPress={() => answer(a.id, true)} disabled={busy === a.id} style={{ flex: 1, minHeight: 42 }} />
                <Button label="Refuser" ghost onPress={() => answer(a.id, false)} disabled={busy === a.id} style={{ flex: 1, minHeight: 42 }} />
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      {data?.list.length ? (
        data.list.map((n) => (
          <Pressable
            key={n.id}
            accessibilityRole="link"
            onPress={() =>
              n.post_id
                ? router.push({ pathname: '/p/[id]', params: { id: n.post_id } })
                : router.push({ pathname: '/u/[handle]', params: { handle: n.actor.handle } })
            }
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderColor: n.read_at ? c.trait : 'rgba(230,200,145,0.35)' }}>
              <ProfilePic name={n.actor.name} src={n.actor.avatar} size={40} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontFamily: fonts.texte, fontSize: 15, lineHeight: 21, color: c.texte }}>
                  <Text style={{ fontFamily: fonts.texteGras }}>{n.actor.name}</Text> {TEXT[n.kind]}
                </Text>
                {n.excerpt ? (
                  <Text numberOfLines={1} style={{ fontFamily: fonts.texte, fontSize: 13, color: c.doux }}>
                    {n.excerpt}
                  </Text>
                ) : null}
                <Text style={{ fontFamily: fonts.texte, fontSize: 12, color: c.doux }}>{relativeTime(n.created_at)}</Text>
              </View>
              {!n.read_at ? <View accessibilityLabel="Nouveau" style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.champagne }} /> : null}
            </Card>
          </Pressable>
        ))
      ) : data && !data.requests.length ? (
        <Body soft>Rien de nouveau. Les abonnements, les j’aime et les commentaires arriveront ici.</Body>
      ) : null}
    </ScrollView>
  );
}
