import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Contact, ContactField, ContactsSortOrder, requestPermissionsAsync } from 'expo-contacts';
import { ArrowLeft, UserX } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/Avatar';
import { ListRow } from '@/components/ui/ListRow';
import { SearchInput } from '@/components/ui/SearchInput';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { GradientButton } from '@/components/ui/GradientButton';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';

const FIELDS = [
  ContactField.FULL_NAME,
  ContactField.PHONES,
  ContactField.EMAILS,
  ContactField.COMPANY,
  ContactField.IMAGE,
] as const;

type ContactDetails = Awaited<ReturnType<typeof Contact.getAllDetails<typeof FIELDS>>>[number];

export interface PickedContact {
  name: string;
  phone?: string;
  avatar?: string;
  email?: string;
  company?: string;
  contactId: string;
}

type PickerState = 'loading' | 'denied' | 'ready';

interface ContactsPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (contact: PickedContact) => void;
}

/**
 * Full-screen modal launched from DebtModal (FEATURE_SPEC 1.8). Always
 * mounted; early-returns nothing meaningful when `visible` is false (mirrors
 * GlassModal's own mount pattern, Part 4) — the `Modal` component itself
 * gates rendering and, on Android, wires hardware back to `onClose` for free.
 */
export function ContactsPicker({ visible, onClose, onSelect }: ContactsPickerProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const [state, setState] = useState<PickerState>('loading');
  const [contacts, setContacts] = useState<ContactDetails[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) return;
    // Resetting to the loading state before kicking off the permission
    // request + fetch below is the point of this effect, not a derivable value.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState('loading');
    setQuery('');
    let cancelled = false;
    (async () => {
      const perm = await requestPermissionsAsync();
      if (cancelled) return;
      if (!perm.granted) {
        setState('denied');
        return;
      }
      const details = await Contact.getAllDetails(FIELDS, {
        sortOrder: ContactsSortOrder.GivenName,
      });
      if (cancelled) return;
      setContacts(details);
      setState('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => (c.fullName ?? '').toLowerCase().includes(q));
  }, [contacts, query]);

  const handleSelect = (contact: ContactDetails) => {
    onSelect({
      name: contact.fullName ?? '',
      phone: contact.phones[0]?.number ?? undefined,
      email: contact.emails[0]?.address ?? undefined,
      company: contact.company ?? undefined,
      avatar: contact.image ?? undefined,
      contactId: contact.id,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.ground, paddingTop: insets.top + 12 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 16,
            paddingBottom: 12,
          }}
        >
          <IconButton
            icon={ArrowLeft}
            accessibilityLabel={t('settings.back')}
            onPress={onClose}
            directional
          />
          <Text style={{ fontSize: 15, fontWeight: '700', color: theme.textPrimary }}>
            {t('contactsPicker.title')}
          </Text>
        </View>

        {state === 'ready' ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
            <SearchInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('contactsPicker.search')}
            />
          </View>
        ) : null}

        {state === 'loading' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: theme.textTertiary, fontSize: 12 }}>
              {t('contactsPicker.loading')}
            </Text>
          </View>
        ) : state === 'denied' ? (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              padding: 24,
            }}
          >
            <EmptyState icon={UserX} caption={t('contactsPicker.denied')} />
            <GradientButton label={t('settings.back')} onPress={onClose} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={{ flex: 1, padding: 16 }}>
            <EmptyState caption={t('contactsPicker.empty')} />
          </View>
        ) : (
          <FlashList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
            renderItem={({ item }) => (
              <ListRow
                leading={
                  <Avatar
                    name={item.fullName ?? undefined}
                    photoUri={item.image ?? undefined}
                    size={40}
                  />
                }
                title={item.fullName ?? t('contactsPicker.unnamed')}
                subtitle={item.phones[0]?.number}
                onPress={() => handleSelect(item)}
              />
            )}
          />
        )}
      </View>
    </Modal>
  );
}
