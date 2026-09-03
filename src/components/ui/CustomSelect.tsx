import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { Check, ChevronRight } from 'lucide-react-native';

import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { BORDER, RADII, TEXT } from '@/constants/theme';
import { SearchInput } from '@/components/ui/SearchInput';

export interface CustomSelectOption<T extends string> {
  label: string;
  value: T;
}

interface CustomSelectProps<T extends string> {
  value: T;
  options: CustomSelectOption<T>[];
  onChange: (value: T) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  sheetTitle?: string;
}

/** Tap-to-open picker; searchable mode adds a SearchInput above the list. */
export function CustomSelect<T extends string>({
  value,
  options,
  onChange,
  searchable = false,
  searchPlaceholder,
  sheetTitle,
}: CustomSelectProps<T>) {
  const { theme } = useTheme();
  const { isRTL } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, searchable]);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
      >
        <Text style={{ fontSize: 11.5, color: TEXT.tertiary }}>{selected?.label ?? '—'}</Text>
        <View style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}>
          <ChevronRight size={13} color={TEXT.tertiary} />
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(2,6,16,0.72)', justifyContent: 'flex-end' }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              maxHeight: '70%',
              backgroundColor: theme.surface,
              borderTopLeftRadius: RADII.sheet,
              borderTopRightRadius: RADII.sheet,
              padding: 16,
              gap: 12,
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 4,
                backgroundColor: `rgba(${theme.glow.a},0.5)`,
                alignSelf: 'center',
              }}
            />
            {sheetTitle ? (
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: TEXT.primary,
                  textAlign: 'center',
                }}
              >
                {sheetTitle}
              </Text>
            ) : null}
            {searchable ? (
              <SearchInput value={query} onChangeText={setQuery} placeholder={searchPlaceholder} />
            ) : null}
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.value}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                      setQuery('');
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: BORDER.hairlineSoft,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: TEXT.primary }}>
                      {item.label}
                    </Text>
                    {isSelected ? (
                      <View
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          backgroundColor: theme.accent1,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Check size={11} color={theme.buttonText} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
