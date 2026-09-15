import React, { useMemo } from 'react';
import { Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { useTheme } from '@/context/ThemeContext';
import { RADII } from '@/constants/theme';
import { withAlpha } from '@/utils/color';

/**
 * Labelled form field + the shared text-input look, used by every form sheet
 * (DebtModal, ExpenseModal, AdjustmentSheet, EditPersonSheet). A composition helper like
 * BrandGlyph — not one of the 18 ui/ primitives — so each form stops carrying
 * its own copy of the same label and input styles.
 */
export function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  const { theme } = useTheme();

  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{
          fontSize: 9.5,
          fontWeight: '700',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: theme.textTertiary,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

/** Uppercase section heading above a list or group (e.g. "Active Debts", "Proofs"). */
export function SectionLabel({ children }: { children: string }) {
  const { theme } = useTheme();

  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: theme.textTertiary,
      }}
    >
      {children}
    </Text>
  );
}

export function useTextFieldStyle() {
  const { theme } = useTheme();

  return useMemo(
    () =>
      ({
        fontSize: 13,
        color: theme.textPrimary,
        backgroundColor: theme.surfaceAlt,
        borderRadius: RADII.field,
        borderWidth: 1,
        borderColor: theme.border,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }) as const,
    [theme],
  );
}

/**
 * The one text input for forms. Owns the field look plus the placeholder,
 * cursor and selection colors, so no input can fall back to a platform default
 * color (the default placeholder grey is near-invisible on dark themes). Pass
 * `style` only to extend the field (e.g. minHeight, LTR alignment).
 */
export function TextField({ style, placeholderTextColor, ...props }: TextInputProps) {
  const { theme } = useTheme();
  const fieldStyle = useTextFieldStyle();

  return (
    <TextInput
      {...props}
      placeholderTextColor={placeholderTextColor ?? theme.textTertiary}
      cursorColor={theme.accent2}
      selectionColor={withAlpha(theme.accent2, 0.35)}
      style={[fieldStyle, style]}
    />
  );
}
