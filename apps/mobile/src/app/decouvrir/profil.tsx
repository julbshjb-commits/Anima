import { handleSchema, suggestHandle } from '@anima/core';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { ProfilePic } from '@/components/social';
import { Body, Button, Card, ErrorText, Field, Loading, Overline } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import { getMe, handleAvailable, leaveNetwork, saveProfile, type MyProfile, type Picture } from '@/lib/reseau';
import { requireClient } from '@/lib/supabase';
import { fonts, useColors } from '@/theme';

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL;

/** Créer ou modifier son profil public. */
export default function ProfilPublic() {
  const c = useColors();
  const router = useRouter();
  const userId = useUserId();
  const [existing, setExisting] = useState<MyProfile | null>();
  const [handle, setHandle] = useState('');
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [avatar, setAvatar] = useState<Picture | null>();
  const [age, setAge] = useState(false);
  const [rules, setRules] = useState(false);
  const [free, setFree] = useState<{ handle: string; ok: boolean }>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const me = await getMe(userId);
        if (me) {
          setHandle(me.handle);
          setName(me.name);
          setBio(me.bio);
          setIsPrivate(me.is_private);
        } else {
          const { data } = await requireClient().from('profiles').select('display_name').eq('id', userId).maybeSingle();
          const first = data?.display_name?.trim() ?? '';
          setName(first.slice(0, 40));
          if (first) setHandle(suggestHandle(first));
        }
        setExisting(me);
      } catch {
        setExisting(null);
        setError('Impossible de charger. Vérifie ta connexion.');
      }
    })();
  }, [userId]);

  // Le pseudo est-il libre ? On attend une petite pause dans la saisie avant de demander.
  const parsed = handleSchema.safeParse(handle);
  const clean = parsed.success ? parsed.data : null;
  useEffect(() => {
    if (!clean) return;
    let live = true;
    const t = setTimeout(() => {
      handleAvailable(clean)
        .then((ok) => live && setFree({ handle: clean, ok }))
        .catch(() => {});
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [clean]);

  if (existing === undefined) return <Loading />;

  const hint = !handle.trim()
    ? undefined
    : !parsed.success
      ? { ok: false, text: parsed.error.issues[0]?.message ?? 'Pseudo invalide.' }
      : free?.handle === clean
        ? free.ok
          ? { ok: true, text: `@${clean} est libre.` }
          : { ok: false, text: `@${clean} est déjà pris.` }
        : undefined;
  const shown = avatar ? avatar.uri : avatar === null ? null : (existing?.avatar ?? null);

  async function pick() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    setAvatar({ uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg', size: a.fileSize ?? 0 });
  }

  async function save() {
    setError(undefined);
    setBusy(true);
    try {
      await saveProfile(userId, { handle, name, bio, isPrivate, avatar, age, rules }, existing ?? null);
      if (existing) router.back();
      else router.replace('/decouvrir');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ton profil n’a pas été enregistré.');
    } finally {
      setBusy(false);
    }
  }

  function leave() {
    if (confirm.trim() !== 'QUITTER') return setError('Écris QUITTER pour confirmer.');
    Alert.alert('Quitter le réseau ?', 'Ton profil public, tes publications, tes abonnés et tes photos publiques seront effacés. Tes journaux, tes notes et tes cartes ne bougent pas.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Quitter',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await leaveNetwork(userId);
            router.dismissTo('/');
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Le départ du réseau a échoué.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.fond }}>
      <Stack.Screen options={{ title: existing ? 'Mon profil public' : 'Créer mon profil' }} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 22, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <ProfilePic name={name || '?'} src={shown} size={76} />
          <View style={{ flex: 1, gap: 8 }}>
            <Button label={shown ? 'Changer la photo' : 'Ajouter une photo'} ghost onPress={pick} disabled={busy} />
            {shown ? (
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setAvatar(null)}>
                <Text style={{ fontFamily: fonts.texteMoyen, fontSize: 13, color: c.doux, textAlign: 'center' }}>Retirer la photo</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Field label="Pseudo" value={handle} onChangeText={setHandle} autoCapitalize="none" autoCorrect={false} maxLength={25} placeholder="zoe_martin" />
          {hint ? (
            <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.texte, fontSize: 13, color: hint.ok ? c.champagne : c.terre }}>
              {hint.text}
            </Text>
          ) : (
            <Body soft style={{ fontSize: 13 }}>
              Lettres, chiffres, point et _. C’est par lui qu’on te trouve.
            </Body>
          )}
        </View>
        <Field label="Nom affiché" value={name} onChangeText={setName} maxLength={40} placeholder="Zoé" />
        <View style={{ gap: 8 }}>
          <Field label="Bio" value={bio} onChangeText={setBio} maxLength={160} multiline placeholder="Quelques mots sur toi" style={{ minHeight: 84, paddingTop: 12, textAlignVertical: 'top' }} />
          <Body soft style={{ fontSize: 12, textAlign: 'right' }}>{`${bio.length} / 160`}</Body>
        </View>

        <Check
          switchStyle
          checked={isPrivate}
          onChange={setIsPrivate}
          title="Compte privé"
          text="Seules les personnes que tu acceptes voient tes publications."
        />

        {!existing ? (
          <Card style={{ gap: 16 }}>
            <Check checked={age} onChange={setAge} title="J’ai 15 ans ou plus" text="Le réseau Anima n’est pas ouvert aux plus jeunes." />
            <Check checked={rules} onChange={setRules} title="J’accepte les règles de la communauté" text="Respect, pas de harcèlement, pas de contenu choquant." />
            {SITE_URL ? (
              <Pressable accessibilityRole="link" hitSlop={8} onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/regles`)}>
                <Text style={{ fontFamily: fonts.texteMoyen, fontSize: 13, color: c.champagne }}>Lire les règles</Text>
              </Pressable>
            ) : null}
          </Card>
        ) : null}

        <ErrorText>{error}</ErrorText>
        <Button label={existing ? 'Enregistrer' : 'Créer mon profil public'} onPress={save} busy={busy} />

        {existing ? (
          <Card style={{ gap: 12, marginTop: 16 }}>
            <Overline>Quitter le réseau</Overline>
            <Body soft>Efface ton profil public, tes publications et tes abonnés. Ton compte Anima et tout ce qui est privé restent.</Body>
            <Field label="Écris QUITTER pour confirmer" value={confirm} onChangeText={setConfirm} autoCapitalize="characters" autoCorrect={false} />
            <Button label="Quitter le réseau" ghost onPress={leave} disabled={busy} />
          </Card>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Check({ checked, onChange, title, text, switchStyle }: { checked: boolean; onChange: (v: boolean) => void; title: string; text: string; switchStyle?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole={switchStyle ? 'switch' : 'checkbox'}
      accessibilityState={{ checked }}
      accessibilityLabel={title}
      onPress={() => onChange(!checked)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      {switchStyle ? (
        <Switch value={checked} onValueChange={onChange} trackColor={{ true: c.champagne, false: c.surface2 }} thumbColor={checked ? c.accentTexte : c.doux} />
      ) : (
        <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 1, borderColor: checked ? c.champagne : c.doux, backgroundColor: checked ? c.champagne : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {checked ? <Text style={{ fontFamily: fonts.texteGras, fontSize: 15, color: c.accentTexte }}>✓</Text> : null}
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.texteMoyen, fontSize: 15, color: c.texte }}>{title}</Text>
        <Text style={{ fontFamily: fonts.texte, fontSize: 13, lineHeight: 18, color: c.doux }}>{text}</Text>
      </View>
    </Pressable>
  );
}
