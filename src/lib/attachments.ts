import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';

/**
 * Proof files for debts (FEATURE_SPEC 1.12, DEBTS_V2_PLAN §5).
 *
 * Storage: `Paths.document/attachments/<uuid>.<ext>`, flat. The database keeps
 * only that relative file name — never an absolute URI (the app container's
 * absolute path can change across iOS updates) and never a debt id in the path
 * (ids are remapped on backup restore, so an id-named folder could end up
 * pointing at another debt's files).
 *
 * Lifecycle: picked → staged in cache (images downscaled, PDFs size-checked) →
 * committed into permanent storage right before its row is inserted. A failed
 * insert deletes the committed file; a deleted row deletes its file; the
 * launch-time reconcile removes anything left orphaned either way.
 *
 * `File.move` / `File.copy` are async in expo-file-system (SDK 57 — `moveSync`/`copySync`
 * are the blocking variants). Every one is awaited: a row written before its file has
 * landed points at nothing (blank thumbnail, "Media not found" in other apps).
 */

export const MAX_PDF_BYTES = 15 * 1024 * 1024;
const IMAGE_LONG_EDGE = 2000;
const IMAGE_QUALITY = 0.85;
const ATTACHMENTS_DIR = 'attachments';
const STAGING_DIR = 'attachments-staging';

export type AttachmentSource = 'camera' | 'library' | 'files';

export interface PickedFile {
  uri: string;
  mimeType: string;
  name: string | null;
  sizeBytes: number | null;
  width?: number;
  height?: number;
}

export interface StagedFile {
  uri: string;
  mimeType: string;
  originalName: string | null;
  sizeBytes: number;
}

export class AttachmentTooLargeError extends Error {
  constructor() {
    super('Attachment exceeds the size limit.');
    this.name = 'AttachmentTooLargeError';
  }
}

export function isPdf(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

function ensureDir(parent: Directory, name: string): Directory {
  const dir = new Directory(parent, name);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function uniqueName(extension: string): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
}

/** Display/share URI for a stored attachment. */
export function attachmentUri(fileName: string): string {
  return new File(Paths.document, ATTACHMENTS_DIR, fileName).uri;
}

// Intent.FLAG_GRANT_READ_URI_PERMISSION — lets the chosen app read the file through its content URI.
const GRANT_READ_URI_PERMISSION = 1;

/**
 * Hands the file to another app. Android: an ACTION_VIEW intent, so the system
 * shows its "Open with" chooser of apps that can view this type. iOS: the share
 * sheet, which is where Quick Look and "Open in…" apps live. Throws when no app
 * can take it.
 */
export async function openAttachmentWith(uri: string, mimeType: string): Promise<void> {
  if (Platform.OS === 'android') {
    const contentUri = await getContentUriAsync(uri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      type: mimeType,
      flags: GRANT_READ_URI_PERMISSION,
    });
    return;
  }
  await shareAttachment(uri, mimeType);
}

/** The system share sheet (e.g. send a receipt over WhatsApp). Throws when sharing isn't available. */
export async function shareAttachment(uri: string, mimeType: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available.');
  await Sharing.shareAsync(uri, {
    mimeType,
    UTI: isPdf(mimeType) ? 'com.adobe.pdf' : 'public.jpeg',
  });
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** Opens the requested system picker. `null` = the user cancelled or denied access. */
export async function pickAttachmentFiles(source: AttachmentSource): Promise<PickedFile[] | null> {
  if (source === 'files') {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return null;
    return result.assets.map((asset) => ({
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'application/pdf',
      name: asset.name ?? null,
      sizeBytes: asset.size ?? null,
    }));
  }

  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return null;
    result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
  } else {
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 1,
    });
  }
  if (result.canceled) return null;
  return result.assets.map((asset) => ({
    uri: asset.uri,
    mimeType: asset.mimeType ?? 'image/jpeg',
    name: asset.fileName ?? null,
    sizeBytes: asset.fileSize ?? null,
    width: asset.width,
    height: asset.height,
  }));
}

/** Normalizes one picked file into the staging area. Throws AttachmentTooLargeError for oversized PDFs. */
export async function stagePickedFile(picked: PickedFile): Promise<StagedFile> {
  const staging = ensureDir(Paths.cache, STAGING_DIR);

  if (!isPdf(picked.mimeType)) {
    const context = ImageManipulator.manipulate(picked.uri);
    const width = picked.width ?? 0;
    const height = picked.height ?? 0;
    if (Math.max(width, height) > IMAGE_LONG_EDGE) {
      context.resize(width >= height ? { width: IMAGE_LONG_EDGE } : { height: IMAGE_LONG_EDGE });
    }
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ compress: IMAGE_QUALITY, format: SaveFormat.JPEG });
    const file = new File(saved.uri);
    await file.move(new File(staging, uniqueName('jpg')));
    return {
      uri: file.uri,
      mimeType: 'image/jpeg',
      originalName: picked.name,
      sizeBytes: file.size ?? 0,
    };
  }

  const source = new File(picked.uri);
  const size = picked.sizeBytes ?? source.size ?? 0;
  if (size > MAX_PDF_BYTES) throw new AttachmentTooLargeError();
  const destination = new File(staging, uniqueName('pdf'));
  await source.copy(destination);
  return {
    uri: destination.uri,
    mimeType: 'application/pdf',
    originalName: picked.name,
    sizeBytes: size,
  };
}

/** Moves a staged file into permanent storage; returns the relative file name to store. */
export async function commitStagedFile(staged: StagedFile): Promise<string> {
  const fileName = uniqueName(isPdf(staged.mimeType) ? 'pdf' : 'jpg');
  await new File(staged.uri).move(new File(ensureDir(Paths.document, ATTACHMENTS_DIR), fileName));
  return fileName;
}

export function discardStagedFile(staged: StagedFile): void {
  try {
    const file = new File(staged.uri);
    if (file.exists) file.delete();
  } catch {
    // Already gone (cache purged or committed) — nothing to discard.
  }
}

export function deleteAttachmentFile(fileName: string): void {
  try {
    const file = new File(Paths.document, ATTACHMENTS_DIR, fileName);
    if (file.exists) file.delete();
  } catch {
    // Already missing — the launch reconcile drops rows like this anyway.
  }
}

/**
 * Copies a stored attachment under a new name. Appending a backup onto a
 * device that still has the original files would otherwise leave two rows
 * sharing one file — and deleting either would break the other.
 */
export async function duplicateAttachmentFile(fileName: string): Promise<string | null> {
  try {
    const source = new File(Paths.document, ATTACHMENTS_DIR, fileName);
    if (!source.exists) return null;
    const copyName = uniqueName(fileName.split('.').pop() ?? 'bin');
    await source.copy(new File(Paths.document, ATTACHMENTS_DIR, copyName));
    return copyName;
  } catch {
    return null;
  }
}

export function attachmentFileExists(fileName: string): boolean {
  try {
    return new File(Paths.document, ATTACHMENTS_DIR, fileName).exists;
  } catch {
    return false;
  }
}

/** Empties the staging folder — anything still there belongs to a form that was abandoned. */
export function clearStagedFiles(): void {
  try {
    const dir = new Directory(Paths.cache, STAGING_DIR);
    if (dir.exists) dir.delete();
  } catch {
    // Cache already cleared by the OS.
  }
}

/**
 * Launch reconcile, file side: deletes stored files no row refers to, and
 * returns the referenced file names whose file is missing (their rows get
 * dropped by the caller).
 */
export function sweepAttachmentFiles(referenced: Set<string>): string[] {
  try {
    const dir = new Directory(Paths.document, ATTACHMENTS_DIR);
    if (dir.exists) {
      for (const entry of dir.list()) {
        if (entry instanceof File && !referenced.has(entry.name)) entry.delete();
      }
    }
  } catch {
    // Best effort — a failed sweep only leaves orphans for next launch.
  }
  return [...referenced].filter((fileName) => !attachmentFileExists(fileName));
}
