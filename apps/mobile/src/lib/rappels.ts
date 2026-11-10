/**
 * Rappel quotidien des flashcards. La notification est programmée sur le téléphone
 * (pas de serveur) : elle revient chaque jour à l'heure choisie, et ouvre le test
 * de 5 cartes. L'heure est enregistrée dans flashcard_settings pour suivre la personne
 * d'un appareil à l'autre.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';

import { requireClient } from './supabase';

export const RAPPEL_ID = 'rappel-cartes';
export const RAPPEL_NOMBRE = 5;

/** Les choix proposés dans l'appli : null désactive le rappel. */
export const RAPPEL_CHOIX: { label: string; heure: string | null }[] = [
  { label: 'Matin, 8 h', heure: '08:00' },
  { label: 'Midi, 12 h 30', heure: '12:30' },
  { label: 'Soir, 20 h', heure: '20:00' },
  { label: 'Aucun', heure: null },
];

/** Affiche la notification même quand l'appli est ouverte. À appeler une fois au démarrage. */
export function preparerNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync('rappels', {
      name: 'Rappels',
      importance: AndroidImportance.DEFAULT,
    });
  }
}

/** Lit l'heure enregistrée pour la personne connectée (null si aucun rappel). */
export async function lireRappel(): Promise<string | null> {
  const { data, error } = await requireClient().from('flashcard_settings').select('rappel_heure').maybeSingle();
  if (error) throw error;
  return data?.rappel_heure ?? null;
}

/** Enregistre l'heure choisie dans les réglages, puis programme la notification sur ce téléphone. */
export async function choisirRappel(heure: string | null): Promise<boolean> {
  const { error } = await requireClient()
    .from('flashcard_settings')
    .upsert({ rappel_heure: heure, updated_at: new Date().toISOString() } as never, { onConflict: 'owner_id' });
  if (error) throw error;
  return programmerRappel(heure);
}

/**
 * Programme (ou annule) le rappel sur ce téléphone. Renvoie false si l'autorisation
 * de notifications a été refusée : l'heure reste enregistrée, mais rien ne sonnera.
 */
export async function programmerRappel(heure: string | null): Promise<boolean> {
  await Notifications.cancelScheduledNotificationAsync(RAPPEL_ID).catch(() => undefined);
  if (!heure) return true;
  const [hour, minute] = heure.split(':').map(Number) as [number, number];

  let statut = await Notifications.getPermissionsAsync();
  if (!statut.granted && statut.canAskAgain) statut = await Notifications.requestPermissionsAsync();
  if (!statut.granted) return false;

  await Notifications.scheduleNotificationAsync({
    identifier: RAPPEL_ID,
    content: {
      title: `Tes ${RAPPEL_NOMBRE} cartes du jour`,
      body: 'Deux minutes pour revoir ce que tu as appris.',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: 'rappels' },
  });
  return true;
}
