import React from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Search, X } from 'lucide-react-native';

import { useTheme } from '@/context/ThemeContext';
import { RADII } from '@/constants/theme';
import { useMirroredText } from '@/lib/useMirroredText';

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

/** Icon + placeholder + clear — one implementation, reused everywhere search appears. */
export function SearchInput({ value, onChangeText, placeholder }: SearchInputProps) {
  const { theme } = useTheme();
  // Local text, so filtering a long list can't make the field lose characters (src/lib/useMirroredText.ts).
  const { text, handleChangeText } = useMirroredText(value, onChangeText);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: RADII.field,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: theme.surfaceAlt,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <Search size={16} color={theme.textTertiary} />
      <TextInput
        value={text}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textTertiary}
        style={{ flex: 1, color: theme.textPrimary, fontSize: 13, padding: 0 }}
      />
      {text.length > 0 && (
        <Pressable
          onPress={() => handleChangeText('')}
          hitSlop={8}
          accessibilityLabel="Clear search"
        >
          <X size={15} color={theme.textTertiary} />
        </Pressable>
      )}
    </View>
  );
}
