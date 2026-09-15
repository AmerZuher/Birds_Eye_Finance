import React, { useMemo, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';

import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { GlassModal } from '@/components/ui/GlassModal';
import { ListCard } from '@/components/ui/ListCard';
import { ListRow } from '@/components/ui/ListRow';
import { SearchInput } from '@/components/ui/SearchInput';
import { useDebts } from '@/context/DebtsContext';
import { useLanguage } from '@/context/LanguageContext';
import type { Person } from '@/db/schema';
import { avatarDisplayUri } from '@/lib/avatars';
import { suggestPeople } from '@/lib/people';
import { HIDDEN_SCROLLBARS } from '@/lib/scroll';

// The list is the sheet's scroller (GlassModal scrollable={false}), so it
// needs a bounded height of its own — FlashList can't size itself to content.
const LIST_HEIGHT_RATIO = 0.5;

interface PersonPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (person: Person) => void;
  title: string;
  excludeIds?: number[];
}

/** Searchable people list in a sheet — "Move to another person" and "Merge into…" (FEATURE_SPEC 1.10/1.11). */
export function PersonPickerSheet({
  visible,
  onClose,
  onSelect,
  title,
  excludeIds,
}: PersonPickerSheetProps) {
  const { t } = useLanguage();
  const { people } = useDebts();
  const { height: windowHeight } = useWindowDimensions();
  const [query, setQuery] = useState('');

  const candidates = useMemo(() => {
    const pool = excludeIds?.length ? people.filter((p) => !excludeIds.includes(p.id)) : people;
    return query.trim() ? suggestPeople(query, pool, pool.length) : pool;
  }, [people, excludeIds, query]);

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <GlassModal visible={visible} onClose={close} title={title} scrollable={false}>
      <SearchInput value={query} onChangeText={setQuery} placeholder={t('personPicker.search')} />
      <View style={{ height: Math.round(windowHeight * LIST_HEIGHT_RATIO) }}>
        <FlashList
          data={candidates}
          keyExtractor={(item) => String(item.id)}
          {...HIDDEN_SCROLLBARS}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={<EmptyState caption={t('personPicker.empty')} />}
          renderItem={({ item, index }) => (
            <ListCard isLast={index === candidates.length - 1}>
              <ListRow
                showBottomBorder={false}
                onPress={() => {
                  setQuery('');
                  onSelect(item);
                }}
                leading={
                  <Avatar name={item.name} photoUri={avatarDisplayUri(item.avatar)} size={36} />
                }
                title={item.name}
                subtitle={[item.phone, item.company].filter(Boolean).join(' · ') || undefined}
              />
            </ListCard>
          )}
        />
      </View>
    </GlassModal>
  );
}
