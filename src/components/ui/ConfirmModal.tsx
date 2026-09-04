import React from 'react';
import { Text, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';

import { GlassModal } from '@/components/ui/GlassModal';
import { GradientButton } from '@/components/ui/GradientButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { useTheme } from '@/context/ThemeContext';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

/** Delete-confirmation sheet — icon badge + title + Cancel/Delete. One implementation for Debt and Expense deletion. */
export function ConfirmModal({
  visible,
  title,
  subtitle,
  onCancel,
  onConfirm,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
}: ConfirmModalProps) {
  const { theme } = useTheme();

  return (
    <GlassModal visible={visible} onClose={onCancel}>
      <View style={{ alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: 'rgba(251,113,133,0.14)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Trash2 size={22} color="#fb7185" />
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
