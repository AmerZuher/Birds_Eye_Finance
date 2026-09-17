import React from 'react';
import { Text, View } from 'react-native';
import { Scale, X } from 'lucide-react-native';

import { IconButton } from '@/components/ui/IconButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { RADII, SEMANTIC } from '@/constants/theme';
import { withAlpha } from '@/utils/color';

interface ReconciliationNudgeCardProps {
  /** One line: how long it's been since the last balance log. */
  message: string;
  actionLabel: string;
  onAction: () => void;
  onDismiss: () => void;
  dismissLabel: string;
}

/**
 * The stale-balance prompt (FEATURE_SPEC 7.4): shown under the Dashboard hero
 * when the last logged balance is older than 30 days.
 *
 * Deliberately InlineBanner's material — the same warning tint, alpha and
 * radius, so it reads as one of the app's messages rather than a second kind
 * of message box (CLAUDE.md rules 3 and 4). It exists as its own primitive
 * only because a banner has no room for an action and a dismiss; everything
 * visual is borrowed, nothing is invented.
 */
export function ReconciliationNudgeCard({
  message,
  actionLabel,
  onAction,
  onDismiss,
  dismissLabel,
}: ReconciliationNudgeCardProps) {
  return (
    <View
      style={{
        borderRadius: RADII.tileLg,
        paddingVertical: 12,
        paddingHorizontal: 12,
        gap: 10,
        backgroundColor: withAlpha(SEMANTIC.warning, 0.14),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Scale size={16} color={SEMANTIC.warning} />
        <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: SEMANTIC.warning }}>
          {message}
        </Text>
        <IconButton
          icon={X}
          onPress={onDismiss}
          accessibilityLabel={dismissLabel}
          size={26}
          iconSize={14}
          color={SEMANTIC.warning}
        />
      </View>
      <SecondaryButton
        label={actionLabel}
        onPress={onAction}
        color={SEMANTIC.warning}
        icon={Scale}
      />
    </View>
  );
}
