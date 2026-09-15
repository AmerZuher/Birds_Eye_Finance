import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react-native';

import { RADII, SEMANTIC } from '@/constants/theme';
import { withAlpha } from '@/utils/color';

export type BannerKind = 'success' | 'warning' | 'error';

interface InlineBannerProps {
  kind: BannerKind;
  message: string;
  onDismiss?: () => void;
  autoDismissMs?: number;
}

const KIND_STYLE: Record<BannerKind, { bg: string; fg: string; Icon: typeof CheckCircle2 }> = {
  success: { bg: withAlpha(SEMANTIC.positive, 0.14), fg: SEMANTIC.positive, Icon: CheckCircle2 },
  warning: { bg: withAlpha(SEMANTIC.warning, 0.14), fg: SEMANTIC.warning, Icon: AlertTriangle },
  error: { bg: withAlpha(SEMANTIC.negative, 0.14), fg: SEMANTIC.negative, Icon: XCircle },
};

/** The one component behind every message and every modal validation error. */
export function InlineBanner({ kind, message, onDismiss, autoDismissMs }: InlineBannerProps) {
  const { bg, fg, Icon } = KIND_STYLE[kind];

  useEffect(() => {
    if (!autoDismissMs || !onDismiss) return;
    const id = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(id);
  }, [autoDismissMs, onDismiss]);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: RADII.tileLg,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: bg,
      }}
    >
      <Icon size={16} color={fg} />
      <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: fg }}>{message}</Text>
    </View>
  );
}
