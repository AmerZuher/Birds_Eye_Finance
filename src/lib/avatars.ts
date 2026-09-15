import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Photos picked for a person (Edit Person, FEATURE_SPEC 1.11). Stored like
 * attachments — relative to the document directory, never as an absolute URI
 * (DEBTS_V2_PLAN §5.2) — and marked with a prefix so `people.avatar` can still
 * hold a contact's own photo URI as-is.
 */
const APP_AVATAR_PREFIX = 'app-avatar:';
const AVATARS_DIR = 'avatars';
const AVATAR_SIZE = 256;

export function avatarDisplayUri(stored: string | null | undefined): string | undefined {
  if (!stored) return undefined;
  if (!stored.startsWith(APP_AVATAR_PREFIX)) return stored;
  return new File(Paths.document, AVATARS_DIR, stored.slice(APP_AVATAR_PREFIX.length)).uri;
}

/** Downscales a picked photo into app storage; returns the value to store in `people.avatar`. */
export async function savePersonAvatar(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: AVATAR_SIZE, height: AVATAR_SIZE });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  const dir = new Directory(Paths.document, AVATARS_DIR);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const fileName = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  // move is async (SDK 57) — the stored value must not point at a file still in flight.
  await new File(saved.uri).move(new File(dir, fileName));
  return `${APP_AVATAR_PREFIX}${fileName}`;
}

/** Deletes a photo this app stored; contact-provided photo URIs are left alone. */
export function deleteStoredAvatar(stored: string | null | undefined): void {
  if (!stored?.startsWith(APP_AVATAR_PREFIX)) return;
  try {
    const file = new File(Paths.document, AVATARS_DIR, stored.slice(APP_AVATAR_PREFIX.length));
    if (file.exists) file.delete();
  } catch {
    // Already missing.
  }
}
