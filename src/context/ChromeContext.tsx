import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { View } from 'react-native';

// GlassHeader and Navbar float as absolute overlays (rule 8 — a real glass
// effect needs content sliding underneath, not pushed down by it). Each
// reports its own rendered height here so every screen can pad its content
// to clear them without hardcoding header/navbar metrics screen-by-screen.
//
// `blurTarget` is the ref every BlurView points at: on Android, expo-blur's
// real blur methods don't automatically sample whatever's behind a view (the
// way iOS's system blur does) — they need an explicit `blurTarget` ref to a
// `BlurTargetView` that wraps the content to blur. app/_layout.tsx wraps the
// route Stack in one `BlurTargetView` using this ref, shared by both the
// header's and navbar's BlurView so either can blur "whatever's on screen".

/** A person's photo recovered after Android restarted the app mid-pick (src/lib/avatars.ts). */
export interface PersonPhotoRequest {
  personId: number;
  /** Already saved into app storage — the value to store in `people.avatar`. */
  avatar: string;
}

interface ChromeContextValue {
  headerHeight: number;
  navbarHeight: number;
  setHeaderHeight: (height: number) => void;
  setNavbarHeight: (height: number) => void;
  blurTarget: RefObject<View | null>;
  /** The active tab's "create new" handler, invoked by the Navbar FAB (FEATURE_SPEC 0.1). */
  setFabHandler: (handler: (() => void) | null) => void;
  triggerFab: () => void;
  /** Queues "open the debt create modal" for the Debts screen to pick up once
   * it gains focus — the FAB is now global (it sits in the navbar's notch on
   * every tab), so pressing it from Dashboard/Analytics has to navigate to
   * Debts first and can't just call that screen's already-registered handler. */
  requestDebtCreate: () => void;
  consumeDebtCreateRequest: () => boolean;
  /** Queues a recovered photo for the Debts screen, which reopens that person's
   * Edit Person sheet with it once it gains focus (same pattern as above). */
  requestPersonPhoto: (request: PersonPhotoRequest) => void;
  consumePersonPhotoRequest: () => PersonPhotoRequest | null;
}

// Reasonable pre-measurement defaults (safe-area + bar + margin) so content
// doesn't jump once the real onLayout measurement lands.
const DEFAULT_HEADER_HEIGHT = 96;
const DEFAULT_NAVBAR_HEIGHT = 96;

const ChromeContext = createContext<ChromeContextValue | null>(null);

export function ChromeProvider({ children }: { children: React.ReactNode }) {
  const [headerHeight, setHeaderHeightState] = useState(DEFAULT_HEADER_HEIGHT);
  const [navbarHeight, setNavbarHeightState] = useState(DEFAULT_NAVBAR_HEIGHT);
  const blurTarget = useRef<View>(null);
  const fabHandlerRef = useRef<(() => void) | null>(null);
  const pendingDebtCreateRef = useRef(false);
  const pendingPersonPhotoRef = useRef<PersonPhotoRequest | null>(null);

  const setHeaderHeight = useCallback((height: number) => {
    setHeaderHeightState((prev) => (Math.abs(prev - height) > 0.5 ? height : prev));
  }, []);

  const setNavbarHeight = useCallback((height: number) => {
    setNavbarHeightState((prev) => (Math.abs(prev - height) > 0.5 ? height : prev));
  }, []);

  const setFabHandler = useCallback((handler: (() => void) | null) => {
    fabHandlerRef.current = handler;
  }, []);

  const triggerFab = useCallback(() => {
    fabHandlerRef.current?.();
  }, []);

  const requestDebtCreate = useCallback(() => {
    pendingDebtCreateRef.current = true;
  }, []);

  const consumeDebtCreateRequest = useCallback(() => {
    const pending = pendingDebtCreateRef.current;
    pendingDebtCreateRef.current = false;
    return pending;
  }, []);

  const requestPersonPhoto = useCallback((request: PersonPhotoRequest) => {
    pendingPersonPhotoRef.current = request;
  }, []);

  const consumePersonPhotoRequest = useCallback(() => {
    const pending = pendingPersonPhotoRef.current;
    pendingPersonPhotoRef.current = null;
    return pending;
  }, []);

  const value = useMemo<ChromeContextValue>(
    () => ({
      headerHeight,
      navbarHeight,
      setHeaderHeight,
      setNavbarHeight,
      blurTarget,
      setFabHandler,
      triggerFab,
      requestDebtCreate,
      consumeDebtCreateRequest,
      requestPersonPhoto,
      consumePersonPhotoRequest,
    }),
    [
      headerHeight,
      navbarHeight,
      setHeaderHeight,
      setNavbarHeight,
      blurTarget,
      setFabHandler,
      triggerFab,
      requestDebtCreate,
      consumeDebtCreateRequest,
      requestPersonPhoto,
      consumePersonPhotoRequest,
    ],
  );

  return <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>;
}

export function useChrome(): ChromeContextValue {
  const ctx = useContext(ChromeContext);
  if (!ctx) throw new Error('useChrome must be used within a ChromeProvider');
  return ctx;
}
