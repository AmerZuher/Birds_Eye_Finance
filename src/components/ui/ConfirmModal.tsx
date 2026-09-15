import React from 'react';
import { Text, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { GlassModal } from '@/components/ui/GlassModal';
import { GradientButton } from '@/components/ui/GradientButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { useTheme } from '@/context/ThemeContext';
import { SEMANTIC } from '@/constants/theme';
import { withAlpha } from '@/utils/color';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Badge icon — a trash can unless given. */
  icon?: LucideIcon;
  /** `negative` (default) for deletions and other destructive actions; `accent` for a
   * confirmation that doesn't destroy anything, e.g. Import. */
  tone?: 'negative' | 'accent';
}

/**
 * Confirmation sheet — icon badge + title + Cancel/Confirm. One implementation for every
 * confirmation: the deletion look by default (Debt and Expense deletion, merges), `icon` +
 * `tone="accent"` for non-destructive ones.
 */
export function ConfirmModal({
  visible,
  title,
  subtitle,
  onCancel,
  onConfirm,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  icon: Icon = Trash2,
  tone = 'negative',
}: ConfirmModalProps) {
  const { theme } = useTheme();
  const badgeBackground =
    tone === 'accent' ? `rgba(${theme.glow.a},0.16)` : withAlpha(SEMANTIC.negative, 0.14);
  const badgeColor = tone === 'accent' ? theme.accent2 : SEMANTIC.negative;

  return (
    <GlassModal visible={visible} onClose={onCancel}>
      <View style={{ alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: badgeBackground,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={22} color={badgeColor} />
        </View>
        <Text
          style={{ fontSize: 15, fontWeight: '700', color: theme.textPrimary, textAlign: 'center' }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ fontSize: 12, color: theme.textTertiary, textAlign: 'center' }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
        <View style={{ flex: 1 }}>
          <SecondaryButton label={cancelLabel} onPress={onCancel} />
        </View>
        <View style={{ flex: 1 }}>
          <GradientButton label={confirmLabel} onPress={onConfirm} />
        </View>
      </View>
    </GlassModal>
  );
}
