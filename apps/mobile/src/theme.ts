/** Design system Anima, mêmes valeurs que apps/web/src/app/globals.css. */
import { useColorScheme } from 'react-native';

const light = {
  fond: '#F5F3EE',
  surface: '#FBFAF7',
  surface2: '#EFEBE3',
  texte: '#151515',
  doux: '#65615B',
  trait: 'rgba(21,21,21,0.1)',
  accent: '#151515',
  accentTexte: '#F5F3EE',
  terre: '#B4654A',
};

const dark: typeof light = {
  fond: '#121211',
  surface: '#1C1B1A',
  surface2: '#292826',
  texte: '#F5F3EE',
  doux: '#A39D93',
  trait: 'rgba(245,243,238,0.12)',
  accent: '#F5F3EE',
  accentTexte: '#151515',
  terre: '#C97B60',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const fonts = {
  titre: 'CormorantGaramond_500Medium',
  titreItalique: 'CormorantGaramond_500Medium_Italic',
  texte: 'Inter_400Regular',
  texteMoyen: 'Inter_500Medium',
  texteGras: 'Inter_600SemiBold',
};
