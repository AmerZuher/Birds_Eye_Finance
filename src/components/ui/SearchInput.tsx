import React from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Search, X } from 'lucide-react-native';

import { useTheme } from '@/context/ThemeContext';
import { TEXT } from '@/constants/theme';

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

/** Icon + placeholder + clear — one implementation, reused everywhere search appears. */
export function SearchInput({ value, onChangeText, placeholder }: SearchInputProps) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: theme.surfaceAlt,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      <Search size={16} color={TEXT.tertiary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={TEXT.tertiary}
        style={{ flex: 1, color: TEXT.primary, fontSize: 13, padding: 0 }}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} hitSlop={8} accessibilityLabel="Clear search">
          <X size={15} color={TEXT.tertiary} />
        </Pressable>
      )}
    </View>
  );
}
