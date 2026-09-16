import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import {
  canInstallPackages,
  clearDownloadedUpdates,
  deleteDownloadedUpdate,
  downloadUpdate,
  fetchLatestRelease,
  installUpdate,
  isCheckDue,
  isTrustedUpdate,
  NotEnoughSpaceError,
  openInstallPermissionSettings,
  readLastCheck,
  readUpdatesAuto,
  writeLastCheck,
  writeUpdatesAuto,
} from '@/lib/updates';
import type { LastCheck, ReleaseInfo } from '@/lib/updates';

/**
 * App updates (FEATURE_SPEC 3.6). The check is cheap and silent; everything that costs data or
 * replaces the app happens only after the user taps Update.
 */

export type UpdateStage =
  'idle' | 'checking' | 'available' | 'downloading' | 'verifying' | 'installing';

export type UpdateError = 'check' | 'download' | 'verify' | 'install' | 'space' | 'permission';

interface UpdatesContextValue {
  /** Automatic daily checks; the manual "Check now" works either way. */
  auto: boolean;
  setAuto: (enabled: boolean) => void;
  stage: UpdateStage;
  /** The newer release found by the last check, if any. */
  release: ReleaseInfo | null;
  lastCheck: LastCheck | undefined;
  /** 0..1 while downloading. */
  progress: number;
  error: UpdateError | null;
  dismissError: () => void;
  checkNow: () => void;
  /** Downloads, verifies and installs the found release. */
  startUpdate: () => void;
  cancel: () => void;
}

const UpdatesContext = createContext<UpdatesContextValue | null>(null);

export function UpdatesProvider({ children }: { children: React.ReactNode }) {
  const [auto, setAutoState] = useState(readUpdatesAuto);
  const [stage, setStage] = useState<UpdateStage>('idle');
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [lastCheck, setLastCheck] = useState<LastCheck | undefined>(readLastCheck);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<UpdateError | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);

  const runCheck = useCallback(async (manual: boolean) => {
    if (busyRef.current) return;
    busyRef.current = true;
    if (manual) setStage('checking');
    try {
      const found = await fetchLatestRelease();
      const check: LastCheck = { at: new Date().toISOString(), version: found?.version ?? null };
      writeLastCheck(check);
      setLastCheck(check);
      setRelease(found);
      setStage(found ? 'available' : 'idle');
      if (manual) setError(null);
    } catch (problem) {
      console.warn('[updates] check failed', problem);
      if (manual) setError('check');
      setStage('idle');
    } finally {
      busyRef.current = false;
    }
  }, []);

  // A leftover APK from a cancelled update never survives a launch.
  useEffect(() => {
    clearDownloadedUpdates();
  }, []);

  // Automatic checks: on launch and on return to the foreground, at most once a day.
  useEffect(() => {
    if (!auto) return;
    const checkIfDue = () => {
      if (isCheckDue()) void runCheck(false);
    };
    checkIfDue();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkIfDue();
    });
    return () => subscription.remove();
  }, [auto, runCheck]);

  const setAuto = useCallback((enabled: boolean) => {
    writeUpdatesAuto(enabled);
    setAutoState(enabled);
  }, []);

  const checkNow = useCallback(() => {
    setError(null);
    void runCheck(true);
  }, [runCheck]);

  const startUpdate = useCallback(() => {
    if (!release || busyRef.current) return;
    if (!canInstallPackages()) {
      setError('permission');
      void openInstallPermissionSettings().catch((problem) =>
        console.warn('[updates] opening the permission page failed', problem),
      );
      return;
    }

    busyRef.current = true;
    setError(null);
    setProgress(0);
    setStage('downloading');
    const controller = new AbortController();
    abortRef.current = controller;

    void (async () => {
      let path: string | null = null;
      try {
        path = await downloadUpdate(release, {
          signal: controller.signal,
          onProgress: setProgress,
        });
        setStage('verifying');
        if (!(await isTrustedUpdate(path, release))) {
          deleteDownloadedUpdate(path);
          setError('verify');
          setStage('available');
          return;
        }
        setStage('installing');
        // Android replaces the app from here; this process usually ends mid-call.
        await installUpdate(path);
      } catch (problem) {
        if (controller.signal.aborted) {
          setStage('available');
        } else {
          console.warn('[updates] update failed', problem);
          if (path) deleteDownloadedUpdate(path);
          setError(
            problem instanceof NotEnoughSpaceError
              ? 'space'
              : stageAtFailure(problem) === 'install'
                ? 'install'
                : 'download',
          );
          setStage('available');
        }
      } finally {
        abortRef.current = null;
        busyRef.current = false;
      }
    })();
  }, [release]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  const value = useMemo<UpdatesContextValue>(
    () => ({
      auto,
      setAuto,
      stage,
      release,
      lastCheck,
      progress,
      error,
      dismissError,
      checkNow,
      startUpdate,
      cancel,
    }),
    [
      auto,
      setAuto,
      stage,
      release,
      lastCheck,
      progress,
      error,
      dismissError,
      checkNow,
      startUpdate,
      cancel,
    ],
  );

  return <UpdatesContext.Provider value={value}>{children}</UpdatesContext.Provider>;
}

/** Install failures come from the native module with their own code; everything else is the download. */
function stageAtFailure(problem: unknown): 'install' | 'download' {
  const code = (problem as { code?: string } | null)?.code ?? '';
  return code.startsWith('ERR_INSTALL') || code === 'ERR_NOT_AN_APK' ? 'install' : 'download';
}

export function useUpdates(): UpdatesContextValue {
  const ctx = useContext(UpdatesContext);
  if (!ctx) throw new Error('useUpdates must be used within an UpdatesProvider');
  return ctx;
}
