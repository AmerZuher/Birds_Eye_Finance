import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import { z } from 'zod';

import AppInstaller from '../../modules/app-installer/src/AppInstallerModule';
import { storage, StorageKeys } from '@/lib/mmkv';

/**
 * App updates (FEATURE_SPEC 3.2 C and 3.6) — CLAUDE.md rule 1's exception (c). The app asks the
 * public GitHub Releases API of its own repository for the latest release: a fixed URL, the same
 * for every user, carrying nothing about them. Only after the user taps Update is the APK
 * downloaded, and it is installed only when it matches the release's published SHA-256 and is the
 * same app, signed with the same key, with a higher versionCode.
 */

const RELEASES_URL = 'https://api.github.com/repos/AmerZuher/Birds_Eye_Finance/releases/latest';
const FETCH_TIMEOUT_MS = 8000;
/** Checked at most once a day while automatic checks are on. */
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** Downloads land here and are cleared at launch, so a cancelled one never lingers. */
const DOWNLOAD_DIR = 'updates';

const releaseSchema = z.object({
  tag_name: z.string(),
  assets: z.array(
    z.object({
      name: z.string(),
      size: z.number(),
      digest: z.string().nullish(),
      browser_download_url: z.string(),
    }),
  ),
});

export interface ReleaseInfo {
  version: string;
  /** Bytes of the APK asset. */
  size: number;
  /** Lowercase hex SHA-256 GitHub publishes for the asset. */
  sha256: string;
  downloadUrl: string;
}

export interface LastCheck {
  /** ISO instant of the last completed check. */
  at: string;
  /** The newer version found, or null when the app was already current. */
  version: string | null;
}

export function installedVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

/** Compares two dotted versions; positive when `a` is newer. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const left = parse(a);
  const right = parse(b);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** On unless the user turned automatic checks off. */
export function readUpdatesAuto(): boolean {
  return storage.getBoolean(StorageKeys.updatesAuto) ?? true;
}

export function writeUpdatesAuto(enabled: boolean): void {
  storage.set(StorageKeys.updatesAuto, enabled);
}

export function readLastCheck(): LastCheck | undefined {
  const raw = storage.getString(StorageKeys.updatesLastCheck);
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return undefined;
    const { at, version } = parsed as Record<string, unknown>;
    if (typeof at !== 'string') return undefined;
    return { at, version: typeof version === 'string' ? version : null };
  } catch {
    return undefined;
  }
}

export function writeLastCheck(check: LastCheck): void {
  storage.set(StorageKeys.updatesLastCheck, JSON.stringify(check));
}

export function isCheckDue(now = Date.now()): boolean {
  const last = readLastCheck();
  if (!last) return true;
  const age = now - Date.parse(last.at);
  // A clock set backwards reads as stale rather than blocking checks forever.
  return Number.isNaN(age) || age < 0 || age >= CHECK_INTERVAL_MS;
}

/** The APK this release should carry, by the release-build naming convention (DEVELOPMENT.md). */
function assetNameFor(version: string): string {
  return `birdsEyeFinance_V${version}.apk`;
}

/**
 * The newest release when it is newer than the installed version and usable, otherwise null.
 * A release counts only when its tag is exactly `v<version>` and it carries the matching APK with
 * a SHA-256 digest; the API's "latest" already excludes drafts and pre-releases.
 */
export async function fetchLatestRelease(): Promise<ReleaseInfo | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(RELEASES_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
    const release = releaseSchema.parse(await response.json());

    const match = /^v(\d+\.\d+\.\d+)$/.exec(release.tag_name);
    if (!match) return null;
    const version = match[1];
    if (compareVersions(version, installedVersion()) <= 0) return null;

    const asset = release.assets.find((item) => item.name === assetNameFor(version));
    const digest = asset?.digest?.replace(/^sha256:/, '');
    if (!asset || !digest) return null;

    return { version, size: asset.size, sha256: digest, downloadUrl: asset.browser_download_url };
  } finally {
    clearTimeout(timer);
  }
}

function downloadDirectory(): Directory {
  const dir = new Directory(Paths.cache, DOWNLOAD_DIR);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Removes any APK left by a cancelled or failed update; runs at launch. */
export function clearDownloadedUpdates(): void {
  try {
    const dir = new Directory(Paths.cache, DOWNLOAD_DIR);
    if (dir.exists) dir.delete();
  } catch (error) {
    console.warn('[updates] clearing old downloads failed', error);
  }
}

export class NotEnoughSpaceError extends Error {
  constructor() {
    super('Not enough free storage for the update');
    this.name = 'NotEnoughSpaceError';
  }
}

/**
 * Downloads the release's APK into the cache. Needs roughly twice its size free: the file itself,
 * plus what Android copies into the install session.
 */
export async function downloadUpdate(
  release: ReleaseInfo,
  options: { onProgress?: (fraction: number) => void; signal?: AbortSignal },
): Promise<string> {
  if (Paths.availableDiskSpace < release.size * 2) throw new NotEnoughSpaceError();

  clearDownloadedUpdates();
  const destination = new File(downloadDirectory(), assetNameFor(release.version));
  const file = await File.downloadFileAsync(release.downloadUrl, destination, {
    idempotent: true,
    signal: options.signal,
    onProgress: ({ bytesWritten, totalBytes }) => {
      const total = totalBytes > 0 ? totalBytes : release.size;
      if (total > 0) options.onProgress?.(Math.min(1, bytesWritten / total));
    },
  });
  return file.uri;
}

/**
 * True only when the file is exactly the published release and a genuine upgrade of this app:
 * matching SHA-256, same package, same signing certificates, and a higher versionCode.
 */
export async function isTrustedUpdate(path: string, release: ReleaseInfo): Promise<boolean> {
  const digest = await AppInstaller.sha256(path);
  if (digest.toLowerCase() !== release.sha256.toLowerCase()) return false;

  const apk = await AppInstaller.inspectApk(path);
  if (apk.packageName !== apk.installedPackageName) return false;
  if (apk.versionCode <= apk.installedVersionCode) return false;

  const installedSignatures = new Set(apk.installedSignatureSha256);
  return (
    apk.signatureSha256.length > 0 &&
    apk.signatureSha256.every((signature) => installedSignatures.has(signature))
  );
}

export function canInstallPackages(): boolean {
  return AppInstaller.canInstallPackages();
}

export async function openInstallPermissionSettings(): Promise<void> {
  await AppInstaller.openInstallPermissionSettings();
}

/** Hands the APK to Android. When it succeeds, the app is replaced and this process ends. */
export async function installUpdate(path: string): Promise<void> {
  await AppInstaller.installApk(path);
}

export function deleteDownloadedUpdate(path: string): void {
  try {
    const file = new File(path);
    if (file.exists) file.delete();
  } catch (error) {
    console.warn('[updates] deleting the download failed', error);
  }
}
