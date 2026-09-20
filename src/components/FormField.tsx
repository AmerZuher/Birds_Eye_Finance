import React, { useCallback, useMemo } from 'react';
import { Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { useTheme } from '@/context/ThemeContext';
import { RADII } from '@/constants/theme';
import { useMirroredText } from '@/lib/useMirroredText';
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
      <Text style={fieldLabelStyle(theme.textTertiary)}>{label}</Text>
      {children}
    </View>
  );
}

/** The uppercase caption both label styles share — inside a FieldBox, or above a FormField. */
function fieldLabelStyle(color: string) {
  return {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color,
  } as const;
}

/**
 * A field whose label sits *inside* the box, which is the shape AmountInput
 * and DateField already have. Use it wherever a field is a block of its own
 * rather than one of a labelled pair sharing a row, so a form doesn't mix the
 * two looks down its length.
 */
export function FieldBox({ label, children }: { label: string; children: React.ReactNode }) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        borderRadius: RADII.field,
        padding: 12,
        gap: 2,
        backgroundColor: theme.surfaceAlt,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <Text style={fieldLabelStyle(theme.textTertiary)}>{label}</Text>
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
 *
 * The text it shows comes from `useMirroredText`, never straight from the
 * caller's state — see that hook for why a plainly controlled input drops
 * characters while deleting on Android.
 *
 * `bare` drops the box (border, fill, padding) for an input already sitting
 * inside a `FieldBox`, keeping only the text and caret colors — the same thing
 * AmountInput's own inner input does.
 */
export function TextField({
  style,
  placeholderTextColor,
  value,
  onChangeText,
  bare,
  ...props
}: TextInputProps & { bare?: boolean }) {
  const { theme } = useTheme();
  const boxStyle = useTextFieldStyle();
  const fieldStyle = bare
    ? ({ fontSize: 13, color: theme.textPrimary, padding: 0, marginTop: 6 } as const)
    : boxStyle;
  const emit = useCallback((next: string) => onChangeText?.(next), [onChangeText]);
  const { text, handleChangeText } = useMirroredText(value ?? '', emit);

  return (
    <TextInput
      {...props}
      value={text}
      onChangeText={handleChangeText}
      placeholderTextColor={placeholderTextColor ?? theme.textTertiary}
      cursorColor={theme.accent2}
      selectionColor={withAlpha(theme.accent2, 0.35)}
      style={[fieldStyle, style]}
    />
  );
}

/** A text field as a labelled block — `FieldBox` plus a bare `TextField`. */
export function TextFieldBlock({
  label,
  ...props
}: TextInputProps & { label: string; bare?: never }) {
  return (
    <FieldBox label={label}>
      <TextField bare {...props} />
    </FieldBox>
  );
}
