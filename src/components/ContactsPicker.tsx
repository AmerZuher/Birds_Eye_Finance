/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability --
 * Reanimated shared values are mutated via `.value =` by design (not React
 * state), and this picker's mount/unmount must lag one animation behind the
 * `visible` prop — both are false positives against the intended pattern
 * (same rationale as GlassModal.tsx, which this mirrors). */
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { BackHandler, Dimensions, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Contact, ContactField, ContactsSortOrder, requestPermissionsAsync } from 'expo-contacts';
import { ArrowLeft, UserX } from 'lucide-react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/Avatar';
import { GlassHeader } from '@/components/ui/GlassHeader';
import { ListCard } from '@/components/ui/ListCard';
import { ListRow } from '@/components/ui/ListRow';
import { SearchInput } from '@/components/ui/SearchInput';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { GradientButton } from '@/components/ui/GradientButton';
import { useTheme } from '@/context/ThemeContext';
import { useChrome } from '@/context/ChromeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useModalPortal } from '@/context/ModalPortalContext';
import { FONTS } from '@/constants/theme';

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

const SCREEN_HEIGHT = Dimensions.get('window').height;
// Same curve GlassModal's sheet travels on (bezier(0.22, 1, 0.36, 1), 350ms)
// — one motion language for every glass surface that slides in, not a
// second one invented just for this picker.
const SLIDE_TIMING = { duration: 350, easing: Easing.bezier(0.22, 1, 0.36, 1) };

/**
 * Full-screen contact picker launched from DebtModal (FEATURE_SPEC 1.8).
 * Renders through ModalPortalContext instead of RN's own `Modal` — same
 * reason GlassModal does (see GlassModal.tsx): a `Modal`'s separate native
 * window can't reach the app's shared `blurTarget`, so its header couldn't
 * use real glass. Portaling keeps it in the main window, where its
 * `GlassHeader` is the exact same primitive/back-button convention as
 * Header.tsx's own back+title row (rule 8).
 */
export function ContactsPicker({ visible, onClose, onSelect }: ContactsPickerProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { headerHeight } = useChrome();
  const { showModal, hideModal } = useModalPortal();
  const modalId = useId();

  const [state, setState] = useState<PickerState>('loading');
  const [contacts, setContacts] = useState<ContactDetails[]>([]);
  const [query, setQuery] = useState('');
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(SCREEN_HEIGHT);
  // Set when an open is armed but the container hasn't been laid out yet;
  // its own onLayout is what actually starts the slide — see GlassModal's
  // identical `openPending` for why this has to wait a frame.
  const openPending = useRef(false);

  useEffect(() => {
    if (visible && !mounted) {
      translateY.value = SCREEN_HEIGHT;
      openPending.current = true;
      setMounted(true);
    } else if (visible) {
      openPending.current = false;
      translateY.value = withTiming(0, SLIDE_TIMING);
    } else if (mounted) {
      openPending.current = false;
      translateY.value = withTiming(SCREEN_HEIGHT, SLIDE_TIMING, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const onContainerLayout = () => {
    if (!openPending.current) return;
    openPending.current = false;
    translateY.value = withTiming(0, SLIDE_TIMING);
  };

  // Registered only while visible so hardware back closes this picker before
  // the DebtModal sheet underneath it — same LIFO stacking GlassModal itself
  // relies on for nested sheets.
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  useEffect(() => {
    if (!visible) return;
    // Resetting to the loading state before kicking off the permission
    // request + fetch below is the point of this effect, not a derivable value.
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

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const content = mounted ? (
    <Animated.View
      onLayout={onContainerLayout}
      style={[
        { position: 'absolute', inset: 0, zIndex: 150, backgroundColor: theme.ground },
        slideStyle,
      ]}
    >
      <GlassHeader>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconButton
            icon={ArrowLeft}
            accessibilityLabel={t('settings.back')}
            onPress={onClose}
            directional
            variant="tinted"
          />
          <Text style={{ fontFamily: FONTS.display, fontSize: 14.5, color: theme.textPrimary }}>
            {t('contactsPicker.title')}
          </Text>
        </View>
      </GlassHeader>

      <View style={{ flex: 1, paddingTop: headerHeight }}>
        {state === 'ready' ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 }}>
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
            renderItem={({ item, index }) => (
              <ListCard isLast={index === filtered.length - 1}>
                <ListRow
                  showBottomBorder={false}
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
              </ListCard>
            )}
          />
        )}
      </View>
    </Animated.View>
  ) : null;

  // Re-syncs the portal's copy of this picker after every render (no dep
  // array) so it's never stale — same pattern GlassModal uses, cheap here
  // since this component only re-renders on real prop/state changes, not on
  // animation frames (those mutate shared values directly).
  useEffect(() => {
    if (content) {
      showModal(modalId, content);
    } else {
      hideModal(modalId);
    }
  });

  useEffect(() => {
    return () => hideModal(modalId);
  }, [modalId, hideModal]);

  return null;
}
