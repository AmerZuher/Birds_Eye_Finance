import React from 'react';
import { View } from 'react-native';

import { useTheme } from '@/context/ThemeContext';
import { RADII } from '@/constants/theme';

const GAP = 10;

interface ListCardProps {
  children: React.ReactNode;
  /** Skips the trailing gap — FlashList's own bottom padding already
   * provides space after the last item, so a gap here would double it up. */
  isLast?: boolean;
}

/**
 * One self-contained rounded card per FlashList row (Debts' person list,
 * Expenses' list). Previously each row was wrapped in a per-item View that
 * only rounded its corners when first/last and otherwise stitched flush
 * into its neighbors via a shared ListRow hairline — identical styling
 * duplicated verbatim in both screens. This replaces that: every row gets
 * its own full radius and border, with a fixed gap below it instead of a
 * shared divider, so there's one definition of "a row card" instead of two.
 */
export function ListCard({ children, isLast = false }: ListCardProps) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: RADII.txList,
        overflow: 'hidden',
        marginBottom: isLast ? 0 : GAP,
      }}
    >
      {children}
    </View>
  );
}
