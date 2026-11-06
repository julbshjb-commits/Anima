/** Design system Anima, édition nuit : mêmes valeurs que apps/web/src/app/globals.css. */

/* L'appli est toujours en nuit graphite, comme le site : un seul look, neutre,
   avec le champagne comme seule couleur d'accent. */
const nuit = {
  fond: '#0C0C0D',
  surface: 'rgba(30,30,32,0.92)',
  surface2: '#1F1F21',
  texte: '#F2EFEA',
  doux: '#A19D97',
  trait: 'rgba(255,255,255,0.08)',
  accent: '#E6C891',
  accentTexte: '#16130F',
  terre: '#E0B878',
  champagne: '#E6C891',
};

export type Colors = typeof nuit;

export function useColors(): Colors {
  return nuit;
}

export const fonts = {
  titre: 'Fraunces_300Light',
  titreItalique: 'Fraunces_300Light_Italic',
  texte: 'Geist_400Regular',
  texteMoyen: 'Geist_500Medium',
  texteGras: 'Geist_600SemiBold',
};
