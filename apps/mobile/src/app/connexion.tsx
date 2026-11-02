/**
 * Connexion sans mot de passe : on reçoit un code à 6 chiffres par e-mail.
 * (Le web utilise un lien ; sur téléphone, un code évite les allers-retours
 * entre l'appli mail et Anima.) Le modèle d'e-mail Supabase doit contenir
 * {{ .Token }} : voir apps/mobile/README.md.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, ErrorText, Field, Overline, Title } from '@/components/ui';
import { requireClient } from '@/lib/supabase';
import { useColors } from '@/theme';

export default function Connexion() {
  const c = useColors();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return setError('Cette adresse e-mail ne semble pas valide.');
    setBusy(true);
    setError(undefined);
    const { error: err } = await requireClient().auth.signInWithOtp({ email: clean, options: { shouldCreateUser: true } });
    setBusy(false);
    if (err) return setError(err.status === 429 ? 'Trop de demandes. Attends une minute avant de réessayer.' : 'L’e-mail n’a pas pu être envoyé. Réessaie.');
    setSentTo(clean);
  }

  async function verify() {
    if (!sentTo) return;
    const token = code.replace(/\D/g, '');
    if (token.length < 6) return setError('Le code contient 6 chiffres.');
    setBusy(true);
    setError(undefined);
    const { error: err } = await requireClient().auth.verifyOtp({ email: sentTo, token, type: 'email' });
    setBusy(false);
    // En cas de succès, la session change et la navigation bascule toute seule vers les journaux.
    if (err) setError('Ce code est incorrect ou a expiré.');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.fond }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 28 }}>
        <View style={{ gap: 10 }}>
          <Overline>Anima</Overline>
          <Title size={44}>{sentTo ? 'Regarde tes e-mails' : 'Ton journal t’attend'}</Title>
          <Body soft>
            {sentTo
              ? `Nous avons envoyé un code à ${sentTo}. Il est valable une heure.`
              : 'Pas de mot de passe : entre ton adresse, nous t’envoyons un code de connexion.'}
          </Body>
        </View>

        {sentTo ? (
          <View style={{ gap: 16 }}>
            <Field
              key="code"
              label="Code à 6 chiffres"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={8}
              autoFocus
              style={{ fontSize: 22, letterSpacing: 6 }}
            />
            <ErrorText>{error}</ErrorText>
            <Button label="Me connecter" onPress={verify} busy={busy} />
            <Button
              label="Changer d’adresse"
              ghost
              onPress={() => {
                setSentTo(undefined);
                setCode('');
                setError(undefined);
              }}
            />
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            <Field
              key="email"
              label="Adresse e-mail"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              autoComplete="email"
              placeholder="toi@exemple.fr"
              onSubmitEditing={sendCode}
            />
            <ErrorText>{error}</ErrorText>
            <Button label="Recevoir un code" onPress={sendCode} busy={busy} />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
