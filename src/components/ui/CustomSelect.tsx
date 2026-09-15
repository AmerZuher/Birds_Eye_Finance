import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Check, ChevronRight } from 'lucide-react-native';

import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { GlassModal } from '@/components/ui/GlassModal';
import { SearchInput } from '@/components/ui/SearchInput';
import { HIDDEN_SCROLLBARS } from '@/lib/scroll';

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
  /** Controlled open state — omit to let CustomSelect manage its own trigger + open state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Suppresses the default label+chevron trigger — for when another element (e.g. AmountInput's currency label) opens this picker instead. */
  hideTrigger?: boolean;
}

/**
 * Tap-to-open picker; searchable mode adds a SearchInput above the list.
 * The sheet itself is a GlassModal (`scrollable={false}` — its own FlatList
 * handles scrolling), so it gets the same swipe-to-dismiss, glass material,
 * and animation as every other sheet for free, instead of duplicating them.
 */
export function CustomSelect<T extends string>({
  value,
  options,
  onChange,
  searchable = false,
  searchPlaceholder,
  sheetTitle,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: CustomSelectProps<T>) {
  const { theme } = useTheme();
  const { isRTL } = useLanguage();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [query, setQuery] = useState('');

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, searchable]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      {hideTrigger ? null : (
        <Pressable
          onPress={() => setOpen(true)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <Text style={{ fontSize: 11.5, color: theme.textTertiary }}>
            {selected?.label ?? '—'}
          </Text>
          <View style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}>
            <ChevronRight size={13} color={theme.textTertiary} />
          </View>
        </Pressable>
      )}

      <GlassModal visible={open} onClose={close} title={sheetTitle} scrollable={false}>
        {searchable ? (
          <SearchInput value={query} onChangeText={setQuery} placeholder={searchPlaceholder} />
        ) : null}
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.value}
          {...HIDDEN_SCROLLBARS}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          style={{ maxHeight: 360 }}
          renderItem={({ item }) => {
            const isSelected = item.value === value;
            return (
              <Pressable
                onPress={() => {
                  onChange(item.value);
                  close();
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.borderSoft,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textPrimary }}>
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
      </GlassModal>
    </>
  );
}
