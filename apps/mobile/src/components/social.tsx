/** Briques du réseau public : photo de profil, carte de publication, j'aime, bouton suivre. */
import { compactCount, MOOD_META, REPORT_REASONS } from '@anima/core';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Animated, Pressable, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import { block, deleteComment, deletePost, follow, setLike, unfollow, type Author, type FeedPost, type Relation, type ReportTarget } from '@/lib/reseau';
import { fonts, useColors } from '@/theme';

/** « à l'instant », « il y a 2 h », « hier », « il y a 4 jours », sinon « 12 oct. ». */
export function relativeTime(iso: string): string {
  const then = new Date(iso);
  const minutes = Math.max(0, Math.round((Date.now() - then.getTime()) / 60000));
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  if (minutes < 24 * 60) return `il y a ${Math.round(minutes / 60)} h`;
  const days = Math.round(minutes / (24 * 60));
  if (days <= 1) return 'hier';
  if (days < 7) return `il y a ${days} jours`;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(then);
}

/** Photo de profil ronde ; sans photo, l'initiale sur un fond champagne discret. */
export function ProfilePic({ name, src, size = 42 }: { name: string; src: string | null; size?: number }) {
  const c = useColors();
  if (src)
    return <Image source={{ uri: src }} accessibilityLabel={`Photo de ${name}`} contentFit="cover" style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.surface2 }} />;
  return (
    <View
      accessibilityLabel={`Profil de ${name}`}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(230,200,145,0.14)', borderWidth: 1, borderColor: 'rgba(230,200,145,0.3)' }}>
      <Text style={{ fontFamily: fonts.titre, fontSize: size * 0.46, color: c.champagne }}>{(name.trim()[0] ?? '?').toUpperCase()}</Text>
    </View>
  );
}

/** Ligne « photo + nom + @pseudo » qui ouvre le profil. */
export function AuthorRow({ author, sub, right, size = 42 }: { author: Author; sub?: string; right?: React.ReactNode; size?: number }) {
  const c = useColors();
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Profil de ${author.name}`}
        onPress={() => router.push({ pathname: '/u/[handle]', params: { handle: author.handle } })}
        style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.7 : 1 })}>
        <ProfilePic name={author.name} src={author.avatar} size={size} />
        <View style={{ flex: 1, gap: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.texteMoyen, fontSize: 15, color: c.texte }}>
            {author.name}
            {author.is_private ? <Text style={{ fontFamily: fonts.texte, fontSize: 12, color: c.doux }}>  · privé</Text> : null}
          </Text>
          <Text numberOfLines={1} style={{ fontFamily: fonts.texte, fontSize: 13, color: c.doux }}>
            @{author.handle}
            {sub ? ` · ${sub}` : ''}
          </Text>
        </View>
      </Pressable>
      {right}
    </View>
  );
}

/** Cœur qui bat quand on aime. La base fait foi : en cas d'échec, on revient en arrière. */
export function LikeButton({ postId, liked, count }: { postId: string; liked: boolean; count: number }) {
  const c = useColors();
  const userId = useUserId();
  const [state, setState] = useState({ liked, count });
  const [scale] = useState(() => new Animated.Value(1));

  async function toggle() {
    const next = !state.liked;
    const before = state;
    setState({ liked: next, count: Math.max(0, state.count + (next ? 1 : -1)) });
    if (next) {
      scale.setValue(0.6);
      Animated.spring(scale, { toValue: 1, friction: 3, tension: 180, useNativeDriver: true }).start();
    }
    if (!(await setLike(userId, postId, next))) setState(before);
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={state.liked ? 'Ne plus aimer' : 'Aimer'}
      accessibilityState={{ selected: state.liked }}
      hitSlop={8}
      onPress={toggle}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 10 }}>
      <Animated.Text style={{ fontSize: 21, lineHeight: 26, color: state.liked ? c.champagne : c.doux, transform: [{ scale }] }}>
        {state.liked ? '♥' : '♡'}
      </Animated.Text>
      {state.count > 0 ? (
        <Text style={{ fontFamily: fonts.texteMoyen, fontSize: 14, color: state.liked ? c.champagne : c.doux, fontVariant: ['tabular-nums'] }}>{compactCount(state.count)}</Text>
      ) : null}
    </Pressable>
  );
}

/** Menu « ⋯ » d'un contenu : supprimer si c'est le mien, sinon signaler ou bloquer. */
export function ContentMenu({
  target,
  author,
  onChanged,
}: {
  target: ReportTarget;
  author: Pick<Author, 'id' | 'handle'>;
  /** Appelé après une suppression ou un blocage, pour recharger ou revenir en arrière. */
  onChanged: () => void;
}) {
  const c = useColors();
  const userId = useUserId();
  const router = useRouter();
  const mine = author.id === userId;

  function open() {
    if (mine) {
      const post = target.kind === 'post';
      return Alert.alert(`Supprimer ${post ? 'cette publication' : 'ce commentaire'} ?`, `${post ? 'Elle' : 'Il'} disparaîtra pour tout le monde, définitivement.`, [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              if (target.kind === 'post') await deletePost(userId, target.id);
              else await deleteComment(target.id);
              onChanged();
            } catch (e) {
              Alert.alert('Suppression impossible', e instanceof Error ? e.message : 'Réessaie.');
            }
          },
        },
      ]);
    }
    Alert.alert(`@${author.handle}`, undefined, [
      {
        text: 'Signaler',
        onPress: () => router.push({ pathname: '/signaler', params: { kind: target.kind, id: target.id, authorId: author.id, handle: author.handle } }),
      },
      {
        text: `Bloquer @${author.handle}`,
        style: 'destructive',
        onPress: () =>
          Alert.alert(`Bloquer @${author.handle} ?`, 'Vous ne verrez plus rien l’un de l’autre, et vos abonnements sont retirés.', [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Bloquer',
              style: 'destructive',
              onPress: async () => {
                try {
                  await block(author.id);
                  onChanged();
                } catch (e) {
                  Alert.alert('Blocage impossible', e instanceof Error ? e.message : 'Réessaie.');
                }
              },
            },
          ]),
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  }

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Plus d’options" hitSlop={12} onPress={open} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 20, lineHeight: 22, color: c.doux }}>⋯</Text>
    </Pressable>
  );
}

const SOURCE: Record<string, string> = { journal: 'Page de journal', note: 'Extrait de notes' };

/** Une publication : auteur, texte ou citation, photo polaroïd, j'aime et commentaires. */
export function PostCard({ post, index = 0, detail = false, onChanged }: { post: FeedPost; index?: number; detail?: boolean; onChanged: () => void }) {
  const c = useColors();
  const router = useRouter();
  const mood = post.mood ? MOOD_META[post.mood] : null;
  const open = () => router.push({ pathname: '/p/[id]', params: { id: post.id } });

  return (
    <Card style={{ gap: 14, padding: 16 }}>
      {post.hidden_at ? (
        <Text style={{ fontFamily: fonts.texte, fontSize: 12, lineHeight: 17, color: c.terre, backgroundColor: 'rgba(224,184,120,0.12)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }}>
          Masquée après des signalements : seuls toi et l’équipe Anima la voyez.
        </Text>
      ) : null}
      <AuthorRow
        author={post.author}
        sub={`${relativeTime(post.created_at)}${post.edited_at ? ' · modifiée' : ''}`}
        right={<ContentMenu target={{ kind: 'post', id: post.id }} author={post.author} onChanged={onChanged} />}
      />

      {mood || SOURCE[post.source] ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {mood ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: `${mood.color}26` }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: mood.color }} />
              <Text style={{ fontFamily: fonts.texte, fontSize: 12, color: mood.color }}>{mood.label}</Text>
            </View>
          ) : null}
          {SOURCE[post.source] ? (
            <Text style={{ fontFamily: fonts.texteMoyen, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: c.champagne, opacity: 0.8 }}>{SOURCE[post.source]}</Text>
          ) : null}
        </View>
      ) : null}

      {post.body ? (
        <Pressable accessibilityRole={detail ? undefined : 'link'} disabled={detail} onPress={open}>
          {post.source === 'citation' ? (
            <View style={{ gap: 8, paddingLeft: 14, borderLeftWidth: 2, borderLeftColor: 'rgba(230,200,145,0.6)' }}>
              <Text style={{ fontFamily: fonts.titreItalique, fontSize: 23, lineHeight: 31, color: c.texte }}>« {post.body} »</Text>
              {post.quote_by ? <Text style={{ fontFamily: fonts.texte, fontSize: 14, color: c.doux }}>— {post.quote_by}</Text> : null}
            </View>
          ) : (
            <Text numberOfLines={detail ? undefined : 9} style={{ fontFamily: fonts.texte, fontSize: 16.5, lineHeight: 26, color: c.texte }}>
              {post.body}
            </Text>
          )}
        </Pressable>
      ) : null}

      {post.photo ? (
        <Pressable accessibilityRole={detail ? undefined : 'link'} accessibilityLabel="Photo de la publication" disabled={detail} onPress={open} style={{ alignSelf: 'flex-start', width: '100%', maxWidth: 380 }}>
          <View
            style={{
              backgroundColor: '#F7F2EA',
              padding: 8,
              paddingBottom: 28,
              borderRadius: 6,
              transform: [{ rotate: index % 2 ? '0.8deg' : '-0.8deg' }],
              shadowColor: '#000',
              shadowOpacity: 0.6,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 14 },
            }}>
            <Image source={{ uri: post.photo }} contentFit="cover" transition={200} style={{ width: '100%', aspectRatio: 4 / 5, borderRadius: 2, backgroundColor: '#E9E2D6' }} />
          </View>
        </Pressable>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: -10, marginBottom: -6 }}>
        <LikeButton key={`${post.id}-${post.liked}-${post.likes_count}`} postId={post.id} liked={post.liked} count={post.likes_count} />
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Commentaires"
          disabled={detail}
          hitSlop={8}
          onPress={open}
          style={{ height: 40, paddingHorizontal: 10, justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.texteMoyen, fontSize: 14, color: c.doux }}>
            {post.comments_count > 0 ? `${compactCount(post.comments_count)} commentaire${post.comments_count > 1 ? 's' : ''}` : 'Commenter'}
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

/** Suivre / Abonné·e / Demande envoyée. */
export function FollowButton({ id, relation, onChanged, small }: { id: string; relation: Pick<Relation, 'following'>; onChanged: () => void; small?: boolean }) {
  const c = useColors();
  const userId = useUserId();
  const [busy, setBusy] = useState(false);
  const on = relation.following !== null;

  async function toggle() {
    setBusy(true);
    try {
      if (on) await unfollow(userId, id);
      else await follow(id);
      onChanged();
    } catch (e) {
      Alert.alert('Abonnement', e instanceof Error ? e.message : 'Réessaie.');
    } finally {
      setBusy(false);
    }
  }

  const label = relation.following === 'accepted' ? 'Abonné·e' : relation.following === 'pending' ? 'Demande envoyée' : 'Suivre';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={on ? `${label}, toucher pour annuler` : 'Suivre'}
      disabled={busy}
      onPress={toggle}
      style={({ pressed }) => ({
        minHeight: small ? 36 : 44,
        paddingHorizontal: small ? 14 : 22,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: on ? 'transparent' : c.accent,
        borderWidth: 1,
        borderColor: on ? c.trait : c.accent,
        opacity: busy ? 0.5 : pressed ? 0.8 : 1,
      })}>
      <Text style={{ fontFamily: fonts.texteGras, fontSize: small ? 13 : 15, color: on ? c.texte : c.accentTexte }}>{label}</Text>
    </Pressable>
  );
}

export const REPORT_REASON_LIST = Object.entries(REPORT_REASONS) as [keyof typeof REPORT_REASONS, string][];
