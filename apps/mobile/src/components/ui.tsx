/** Briques d'interface partagées par les écrans (mêmes intentions que apps/web/src/components/ui.ts). */
import { coverOf, MOOD_META, type Mood } from '@anima/core';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fonts, useColors } from '@/theme';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const c = useColors();
  const body = <View style={styles.inner}>{children}</View>;
  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: c.fond }}>
      {scroll ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

export function Title({ children, size = 34, style, ...rest }: TextProps & { size?: number }) {
  const c = useColors();
  return (
    <Text accessibilityRole="header" style={[{ fontFamily: fonts.titre, fontSize: size, lineHeight: size * 1.1, color: c.texte }, style]} {...rest}>
      {children}
    </Text>
  );
}

export function Overline({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={{ fontFamily: fonts.texteMoyen, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: c.doux }}>{children}</Text>;
}

export function Body({ children, soft, style, ...rest }: TextProps & { soft?: boolean }) {
  const c = useColors();
  return (
    <Text style={[{ fontFamily: fonts.texte, fontSize: 15, lineHeight: 22, color: soft ? c.doux : c.texte }, style]} {...rest}>
      {children}
    </Text>
  );
}

export function Button({
  label,
  onPress,
  ghost,
  disabled,
  busy,
  style,
}: {
  label: string;
  onPress: () => void;
  ghost?: boolean;
  disabled?: boolean;
  busy?: boolean;
  style?: ViewStyle;
}) {
  const c = useColors();
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        ghost ? { borderWidth: 1, borderColor: c.trait } : { backgroundColor: c.accent },
        { opacity: off ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}>
      {busy ? <ActivityIndicator color={ghost ? c.texte : c.accentTexte} /> : null}
      <Text style={{ fontFamily: fonts.texteMoyen, fontSize: 15, color: ghost ? c.texte : c.accentTexte }}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, style, ...rest }: TextInputProps & { label: string }) {
  const c = useColors();
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: fonts.texteMoyen, fontSize: 13, color: c.texte }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.doux}
        style={[styles.input, { borderColor: c.trait, backgroundColor: c.surface, color: c.texte, fontFamily: fonts.texte }, style]}
        {...rest}
      />
    </View>
  );
}

export function ErrorText({ children }: { children?: string }) {
  const c = useColors();
  if (!children) return null;
  return (
    <Text accessibilityRole="alert" style={{ fontFamily: fonts.texte, fontSize: 14, color: c.terre }}>
      {children}
    </Text>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.trait }, style]}>{children}</View>;
}

/** Couverture en dégradé simulé : deux bandes de la palette de la couverture. */
export function Cover({ id, size = 56 }: { id: string; size?: number }) {
  const cover = coverOf(id);
  return (
    <View style={{ width: size * 0.75, height: size, borderRadius: 6, overflow: 'hidden', backgroundColor: cover.to }}>
      <View style={{ flex: 2, backgroundColor: cover.from }} />
      <View style={{ position: 'absolute', left: 4, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(0,0,0,0.12)' }} />
    </View>
  );
}

export function MoodDot({ mood, size = 10 }: { mood: Mood | null; size?: number }) {
  if (!mood) return null;
  return (
    <View
      accessibilityLabel={MOOD_META[mood].label}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: MOOD_META[mood].color }}
    />
  );
}

export function Loading() {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.fond }}>
      <ActivityIndicator color={c.doux} />
    </View>
  );
}

const styles = StyleSheet.create({
  inner: { flexGrow: 1, padding: 20, gap: 20, width: '100%', maxWidth: 640, alignSelf: 'center' },
  button: { minHeight: 48, borderRadius: 999, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 16 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16 },
});
