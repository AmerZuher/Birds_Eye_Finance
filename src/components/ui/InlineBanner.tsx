import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react-native';

export type BannerKind = 'success' | 'warning' | 'error';

interface InlineBannerProps {
  kind: BannerKind;
  message: string;
  onDismiss?: () => void;
  autoDismissMs?: number;
}

const KIND_STYLE: Record<BannerKind, { bg: string; fg: string; Icon: typeof CheckCircle2 }> = {
  success: { bg: 'rgba(52,211,153,0.14)', fg: '#34d399', Icon: CheckCircle2 },
  warning: { bg: 'rgba(251,191,36,0.14)', fg: '#fbbf24', Icon: AlertTriangle },
  error: { bg: 'rgba(251,113,133,0.14)', fg: '#fb7185', Icon: XCircle },
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
        borderRadius: 14,
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
