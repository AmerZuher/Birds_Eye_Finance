import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { getJSON, setJSON, storage, StorageKeys } from '@/lib/mmkv';

/**
 * Photos picked in the app — a person's (Edit Person, FEATURE_SPEC 1.11) and the profile's
 * (Edit Profile, 3.3). Stored like attachments: a small JPEG under the document directory,
 * referenced by a relative `app-avatar:<file>` value, never an absolute URI (the container
 * path can change across iOS updates — DEBTS_V2_PLAN §5.2). The prefix lets `people.avatar`
 * still hold a contact's own photo URI as-is.
 */
const APP_AVATAR_PREFIX = 'app-avatar:';
const AVATARS_DIR = 'avatars';
const AVATAR_SIZE = 256;
/** A recovered pick older than this is dropped rather than applied out of the blue. */
const PENDING_PICK_MAX_AGE_MS = 10 * 60 * 1000;
/** Profile photos saved before 2.1.0: `file://…/profile-avatar-<ms>.jpg` in the document root. */
const LEGACY_PROFILE_AVATAR = /^profile-avatar-\d+\.jpg$/;

function avatarFile(fileName: string): File {
  return new File(Paths.document, AVATARS_DIR, fileName);
}

function avatarsDirectory(): Directory {
  const dir = new Directory(Paths.document, AVATARS_DIR);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export function avatarDisplayUri(stored: string | null | undefined): string | undefined {
  if (!stored) return undefined;
  if (!stored.startsWith(APP_AVATAR_PREFIX)) return stored;
  return avatarFile(stored.slice(APP_AVATAR_PREFIX.length)).uri;
}

/** Whether a stored photo value can be shown on this device — an imported one may name a file that only exists on another phone. */
export function isAvatarAvailable(stored: string | null | undefined): boolean {
  if (!stored) return false;
  if (stored.startsWith(APP_AVATAR_PREFIX)) {
    return avatarFile(stored.slice(APP_AVATAR_PREFIX.length)).exists;
  }
  return stored.startsWith('data:image/') || /^https?:\/\//.test(stored);
}

/**
 * Downscales a picked photo into app storage and returns the value to store. A small file with
 * a fresh name per pick — not a base64 data URI, which turned every profile write into a
 * multi-megabyte MMKV write and crashed the release APK on real hardware (DEVELOPMENT.md,
 * gotcha 4); and not a reused name, since Image caches by URI and could keep the old photo.
 */
export async function saveAvatarImage(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: AVATAR_SIZE, height: AVATAR_SIZE });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  const fileName = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  // move is async (SDK 57) — the stored value must not point at a file still in flight.
  await new File(saved.uri).move(new File(avatarsDirectory(), fileName));
  return `${APP_AVATAR_PREFIX}${fileName}`;
}

/** Deletes a photo this app stored; contact-provided photo URIs are left alone. */
export function deleteStoredAvatar(stored: string | null | undefined): void {
  if (!stored) return;
  try {
    let file: File | null = null;
    if (stored.startsWith(APP_AVATAR_PREFIX)) {
      file = avatarFile(stored.slice(APP_AVATAR_PREFIX.length));
    } else if (stored.startsWith('file://')) {
      const fileName = stored.split('/').pop() ?? '';
      if (LEGACY_PROFILE_AVATAR.test(fileName)) file = new File(Paths.document, fileName);
    }
    if (file?.exists) file.delete();
  } catch {
    // Already missing.
  }
}

/**
 * Moves a pre-2.1.0 profile photo (stored as an absolute document-directory URI) into the
 * avatars folder and returns the relative value to store instead — null when there is nothing
 * to migrate. The file is looked up by name in the current document directory, because the
 * stored absolute path itself may be stale.
 */
export async function migrateLegacyProfileAvatar(
  stored: string | undefined,
): Promise<string | null> {
  if (!stored?.startsWith('file://')) return null;
  const fileName = stored.split('/').pop() ?? '';
  if (!LEGACY_PROFILE_AVATAR.test(fileName)) return null;
  const legacy = new File(Paths.document, fileName);
  if (!legacy.exists) return null;
  await legacy.move(new File(avatarsDirectory(), fileName));
  return `${APP_AVATAR_PREFIX}${fileName}`;
}

export type PhotoPickTarget = { kind: 'profile' } | { kind: 'person'; personId: number };

export type PhotoPickResult =
  { kind: 'picked'; uri: string } | { kind: 'canceled' } | { kind: 'denied' };

/**
 * A square photo from the library, with the same picker settings everywhere a photo is picked
 * for someone. The target is remembered while the picker is open: Android can destroy the app's
 * Activity meanwhile, and the photo then only arrives after the restart, through
 * recoverPendingPhotoPick() (DEVELOPMENT.md, gotcha 3).
 */
export async function pickAvatarPhoto(target: PhotoPickTarget): Promise<PhotoPickResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { kind: 'denied' };
  setJSON(StorageKeys.pendingPhotoPick, { ...target, at: Date.now() });
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      // Not 1: a full-resolution result is several MB to decode, and it's cut to 256px anyway.
      quality: 0.7,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    return asset ? { kind: 'picked', uri: asset.uri } : { kind: 'canceled' };
  } finally {
    storage.remove(StorageKeys.pendingPhotoPick);
  }
}

/** A photo picked right before Android destroyed the Activity, with who it was for — or null. Consumes it. */
export async function recoverPendingPhotoPick(): Promise<{
  target: PhotoPickTarget;
  uri: string;
} | null> {
  const stored = getJSON<{ kind?: unknown; personId?: unknown; at?: unknown }>(
    StorageKeys.pendingPhotoPick,
  );
  if (!stored) return null;
  storage.remove(StorageKeys.pendingPhotoPick);
  if (typeof stored.at !== 'number' || Date.now() - stored.at > PENDING_PICK_MAX_AGE_MS)
    return null;

  let target: PhotoPickTarget;
  if (stored.kind === 'profile') target = { kind: 'profile' };
  else if (stored.kind === 'person' && typeof stored.personId === 'number') {
    target = { kind: 'person', personId: stored.personId };
  } else return null;

  const pending = await ImagePicker.getPendingResultAsync();
  if (!pending || 'code' in pending || pending.canceled) return null;
  const asset = pending.assets[0];
  return asset ? { target, uri: asset.uri } : null;
}
