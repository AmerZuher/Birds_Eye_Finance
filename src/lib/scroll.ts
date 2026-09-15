/**
 * FEATURE_SPEC 0.9 — no visible scroll indicators anywhere. Spread onto every
 * ScrollView / FlatList / FlashList, existing and new, so hiding them is one
 * definition rather than a prop pair copied (and forgotten) per call site.
 */
export const HIDDEN_SCROLLBARS = {
  showsVerticalScrollIndicator: false,
  showsHorizontalScrollIndicator: false,
} as const;
