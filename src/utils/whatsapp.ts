import { Linking } from 'react-native';

/**
 * Strips separators, removes a leading +/00, and swaps a leading national 0
 * for Saudi's 966 country code (FEATURE_SPEC 1.6 — Saudi default;
 * international users should store full numbers).
 */
export function normalizePhone(phone: string): string {
  let digits = phone.replace(/[\s\-()]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `966${digits.slice(1)}`;
  return digits;
}

/** Opens the WhatsApp deep link for a phone + prefilled message, guarded by canOpenURL. */
export async function openWhatsApp(phone: string, message: string): Promise<boolean> {
  const url = `whatsapp://send?phone=${normalizePhone(phone)}&text=${encodeURIComponent(message)}`;
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) return false;
  await Linking.openURL(url);
  return true;
}
