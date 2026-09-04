import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/context/ThemeContext';

interface ListRowProps {
  leading?: React.ReactNode;
  title: string;
  /** Plain text renders through the default subtitle style; pass a node for richer content (e.g. an icon + text row). */
  subtitle?: string | React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  showBottomBorder?: boolean;
}

/** icon-or-avatar + title + subtitle + trailing value — base for transaction/person/settings rows. */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  showBottomBorder = true,
}: ListRowProps) {
  const { theme } = useTheme();
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        padding: 12,
        // A faint wash barely lighter than the surface on dark themes reads
        // as a highlight; the same wash in white would be invisible-to-wrong
        // on a light surface, so it flips to a faint darken there instead —
        // same idea (very slightly distinct from its own background) on
        // either kind of theme.
        backgroundColor: theme.isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)',
        borderBottomWidth: showBottomBorder ? 1 : 0,
        borderBottomColor: theme.borderSoft,
      }}
    >
      {leading}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 13, fontWeight: '700', color: theme.textPrimary }}
        >
          {title}
        </Text>
        {subtitle ? (
          typeof subtitle === 'string' ? (
            <Text
              numberOfLines={1}
              style={{ fontSize: 10.5, color: theme.textTertiary, marginTop: 1 }}
            >
              {subtitle}
            </Text>
          ) : (
            subtitle
          )
        ) : null}
      </View>
      {trailing}
    </Wrapper>
  );
}
