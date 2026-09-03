import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

// Lets a deeply-nested component (GlassModal) render its content at the
// app's root instead of wherever it's declared in the tree. This exists
// specifically so GlassModal's BlurView can share the same `blurTarget` as
// the header/navbar (rule 8) — real cross-content blur only works within
// the main window, and RN's own `Modal` component renders into a separate
// native window where that target isn't reachable at all. See GlassModal.tsx.
//
// Two separate contexts, deliberately: GlassModal instances only ever need
// the (permanently stable) action functions, never the `modals` list itself
// — only ModalPortalOutlet reads that. Putting both in one context meant
// every GlassModal re-rendered on every open/close of any sheet anywhere in
// the app (React re-renders a context consumer whenever the provided value
// changes, regardless of which part of it that consumer actually reads),
// which re-ran GlassModal's dependency-less sync effect, called showModal
// again, changed the list again — an infinite "Maximum update depth
// exceeded" loop. Splitting them means the actions object never changes
// identity, so subscribing to it alone never triggers a re-render.

interface PortalEntry {
  id: string;
  node: React.ReactNode;
}

interface ModalPortalActions {
  showModal: (id: string, node: React.ReactNode) => void;
  hideModal: (id: string) => void;
}

const ModalPortalActionsContext = createContext<ModalPortalActions | null>(null);
const ModalPortalStateContext = createContext<PortalEntry[] | null>(null);

export function ModalPortalProvider({ children }: { children: React.ReactNode }) {
  const [modals, setModals] = useState<PortalEntry[]>([]);

  // Updates in place (rather than filter+push) so an already-open modal's
  // z-order stays put across re-renders — only a genuinely new id appends.
  const showModal = useCallback((id: string, node: React.ReactNode) => {
    setModals((prev) => {
      const index = prev.findIndex((m) => m.id === id);
      if (index === -1) return [...prev, { id, node }];
      const next = [...prev];
      next[index] = { id, node };
      return next;
    });
  }, []);

  const hideModal = useCallback((id: string) => {
    setModals((prev) => (prev.some((m) => m.id === id) ? prev.filter((m) => m.id !== id) : prev));
  }, []);

  // Never changes identity — showModal/hideModal are themselves permanently
  // stable (empty-deps useCallback), so this object is created once.
  const actions = useMemo<ModalPortalActions>(
    () => ({ showModal, hideModal }),
    [showModal, hideModal],
  );

  return (
    <ModalPortalActionsContext.Provider value={actions}>
      <ModalPortalStateContext.Provider value={modals}>{children}</ModalPortalStateContext.Provider>
    </ModalPortalActionsContext.Provider>
  );
}

export function useModalPortal(): ModalPortalActions {
  const ctx = useContext(ModalPortalActionsContext);
  if (!ctx) throw new Error('useModalPortal must be used within a ModalPortalProvider');
  return ctx;
}

/** Renders whatever's currently registered — mount once, above everything else (after Header in app/_layout.tsx). */
export function ModalPortalOutlet() {
  const modals = useContext(ModalPortalStateContext);
  if (!modals) throw new Error('ModalPortalOutlet must be used within a ModalPortalProvider');
  return (
    <>
      {modals.map((m) => (
        <React.Fragment key={m.id}>{m.node}</React.Fragment>
      ))}
    </>
  );
}
