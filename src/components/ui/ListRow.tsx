import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { TEXT, BORDER } from '@/constants/theme';

interface ListRowProps {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
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
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        padding: 12,
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderBottomWidth: showBottomBorder ? 1 : 0,
        borderBottomColor: BORDER.hairlineSoft,
      }}
    >
      {leading}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: TEXT.primary }}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={{ fontSize: 10.5, color: TEXT.tertiary, marginTop: 1 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </Wrapper>
  );
}
