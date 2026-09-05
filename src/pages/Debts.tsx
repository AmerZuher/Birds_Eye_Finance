import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import Animated, { SlideInLeft, SlideInRight } from 'react-native-reanimated';
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  ChevronRight,
  History,
  Mail,
  StickyNote,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react-native';

import { PageTransition } from '@/components/PageTransition';
import { Avatar } from '@/components/ui/Avatar';
import { GlassModal } from '@/components/ui/GlassModal';
import { GradientButton } from '@/components/ui/GradientButton';
import { ListCard } from '@/components/ui/ListCard';
import { ListRow } from '@/components/ui/ListRow';
import { SearchInput } from '@/components/ui/SearchInput';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { IconTile } from '@/components/ui/IconTile';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { InlineBanner } from '@/components/ui/InlineBanner';
import { DebtModal } from '@/components/DebtModal';
import type { DebtPrefill } from '@/components/DebtModal';
import { BrandGlyph } from '@/components/BrandGlyph';
import { MoneyStatCard } from '@/components/MoneyStatCard';
import { MoneyAmount } from '@/components/ui/MoneyAmount';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeShape } from '@/constants/theme';
import { useChrome } from '@/context/ChromeContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useFinance } from '@/context/FinanceContext';
import type { DebtGroup, DebtGroupType } from '@/context/FinanceContext';
import type { Debt } from '@/db/schema';
import { FONTS, RADII, SEMANTIC } from '@/constants/theme';
import { openWhatsApp } from '@/utils/whatsapp';

function matchesSearch(group: DebtGroup, query: string): boolean {
  if (group.name.toLowerCase().includes(query)) return true;
  if (group.phone?.toLowerCase().includes(query)) return true;
  if (group.email?.toLowerCase().includes(query)) return true;
  if (group.company?.toLowerCase().includes(query)) return true;
  return group.transactions.some(
    (tx) =>
      tx.notes?.toLowerCase().includes(query) ||
      tx.date.toLowerCase().includes(query) ||
      String(tx.amount).toLowerCase().includes(query),
  );
}

function netColor(type: DebtGroupType, theme: ThemeShape): string {
  if (type === 'positive') return SEMANTIC.positive;
  if (type === 'negative') return SEMANTIC.negative;
  return theme.textSecondary;
}

export default function Debts() {
  const { t } = useLanguage();
  const { setFabHandler, consumeDebtCreateRequest } = useChrome();
  const { formatMoney, formatOriginalMoney } = useCurrency();
  const { groupedDebts, debtsCalculations, deletedDebts, deleteDebt, permanentlyDeleteDebt } =
    useFinance();

  const [search, setSearch] = useState('');
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  // null = the flat, all-people history (opened from the summary view); a
  // name = filtered to just that person (opened from their detail view).
  const [historyPersonName, setHistoryPersonName] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [createPrefill, setCreatePrefill] = useState<DebtPrefill | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Debt | null>(null);
  const [forgetTarget, setForgetTarget] = useState<Debt | null>(null);
  const [whatsAppError, setWhatsAppError] = useState('');

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groupedDebts;
    return groupedDebts.filter((group) => matchesSearch(group, q));
  }, [groupedDebts, search]);

  // Deleting a debt inside a person view optimistically patches the
  // selection via groupedDebts' own live-query reactivity; once zero
  // transactions remain for that name, selectedGroup itself resolves to
  // null and the detail view closes on its own — no extra effect needed
  // to reset selectedName (1.5).
  const selectedGroup = useMemo(
    () => groupedDebts.find((g) => g.name === selectedName) ?? null,
    [groupedDebts, selectedName],
  );

  // Android back: an open person detail returns to the list (FEATURE_SPEC 0.2).
  // Registered only while a detail view is actually showing — keyed off
  // selectedGroup (not selectedName) so it unregisters itself the instant
  // the group disappears (e.g. its last transaction was just deleted),
  // rather than leaving a stale listener around.
  useEffect(() => {
    if (!selectedGroup) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelectedName(null);
      return true;
    });
    return () => sub.remove();
  }, [selectedGroup]);

  // Same back-to-list pattern for the history screen. Reachable from either
  // the summary view or a person's detail view — when opened from detail,
  // selectedGroup is still set underneath it, so both this and the
  // person-detail listener above end up registered simultaneously. RN's
  // BackHandler stack is LIFO and this effect runs (registers) after the
  // selectedGroup one, so a back press here correctly closes history first
  // and reveals the still-open detail view, rather than skipping past it.
  useEffect(() => {
    if (!historyOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setHistoryOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [historyOpen]);

  const historyDebts = useMemo(() => {
    if (!historyPersonName) return deletedDebts;
    return deletedDebts.filter((d) => d.name.trim() === historyPersonName);
  }, [deletedDebts, historyPersonName]);

  // Opening the FAB from inside a person's detail view prefills the new
  // debt's identity fields with that person's data instead of a blank form.
  // Re-registered (via the effect below) whenever selectedGroup changes, so
  // the FAB always reflects whichever view is currently showing.
  const openCreateModal = useCallback(() => {
    setEditingDebt(null);
    setCreatePrefill(
      selectedGroup
        ? {
          name: selectedGroup.name,
          phone: selectedGroup.phone,
          email: selectedGroup.email,
          company: selectedGroup.company,
          avatar: selectedGroup.avatar,
          contactId: selectedGroup.contactId,
        }
        : null,
    );
    setModalOpen(true);
  }, [selectedGroup]);

  // Registered on focus, not mount — expo-router keeps tab screens mounted
  // after they've been visited, so a mount-time effect would leave whichever
  // tab was visited last "owning" the FAB handler forever.
  //
  // Debt is the global FAB's default target (it's the notch button on every
  // tab now), so pressing it from Dashboard/Analytics navigates here and
  // leaves a request behind for this screen to pick up on arrival.
  useFocusEffect(
    useCallback(() => {
      setFabHandler(openCreateModal);
      if (consumeDebtCreateRequest()) openCreateModal();
    }, [setFabHandler, openCreateModal, consumeDebtCreateRequest]),
  );

  const openEditModal = (debt: Debt) => {
    setEditingDebt(debt);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDebt(deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleForget = async () => {
    if (!forgetTarget) return;
    await permanentlyDeleteDebt(forgetTarget.id);
    setForgetTarget(null);
  };

  const handleWhatsApp = async () => {
    if (!selectedGroup?.phone) return;
    const lines = selectedGroup.transactions.map((tx) => {
      const typeLabel = t(tx.type === 'positive' ? 'debts.type.positive' : 'debts.type.negative');
      const amount = formatOriginalMoney(tx.amount, tx.currency ?? 'SAR');
      return tx.date
        ? t('debts.whatsapp.lineWithDate', { type: typeLabel, amount, date: tx.date })
        : t('debts.whatsapp.line', { type: typeLabel, amount });
    });
    const message = [
      t('debts.whatsapp.greeting', { name: selectedGroup.name }),
      t('debts.whatsapp.total', { amount: formatMoney(selectedGroup.totalNet) }),
      '',
      ...lines,
    ].join('\n');
    const opened = await openWhatsApp(selectedGroup.phone, message);
    if (!opened) setWhatsAppError(t('debts.whatsapp.error'));
  };

  const netBalance = debtsCalculations.totalPositiveAmount - debtsCalculations.totalNegativeAmount;

  return (
    <>
      <PageTransition>
        {historyOpen ? (
          <HistoryView
            debts={historyDebts}
            personName={historyPersonName}
            onBack={() => setHistoryOpen(false)}
            onForget={setForgetTarget}
          />
        ) : selectedGroup ? (
          <DetailView
            group={selectedGroup}
            onBack={() => setSelectedName(null)}
            onEdit={openEditModal}
            onWhatsApp={handleWhatsApp}
            whatsAppError={whatsAppError}
            onDismissWhatsAppError={() => setWhatsAppError('')}
            onOpenHistory={() => {
              setHistoryPersonName(selectedGroup.name);
              setHistoryOpen(true);
            }}
          />
        ) : (
          <SummaryView
            groups={filteredGroups}
            search={search}
            onSearchChange={setSearch}
            netBalance={netBalance}
            totalNegativeMonthly={debtsCalculations.totalNegativeMonthly}
            onSelect={setSelectedName}
            onOpenHistory={() => {
              setHistoryPersonName(null);
              setHistoryOpen(true);
            }}
          />
        )}
      </PageTransition>

      <DebtModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        editingDebt={editingDebt}
        prefill={createPrefill}
        onRequestDelete={() => {
          setModalOpen(false);
          setDeleteTarget(editingDebt);
        }}
      />

      <ConfirmModal
        visible={!!deleteTarget}
        title={t('debts.deleteTitle')}
        subtitle={deleteTarget?.name}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
      />

      <ConfirmModal
        visible={!!forgetTarget}
        title={t('debts.deleteForeverTitle')}
        subtitle={
          forgetTarget ? t('debts.deleteForeverSubtitle', { name: forgetTarget.name }) : undefined
        }
        onCancel={() => setForgetTarget(null)}
        onConfirm={handleForget}
        confirmLabel={t('debts.deleteForever')}
        cancelLabel={t('common.cancel')}
      />
    </>
  );
}

interface SummaryViewProps {
  groups: DebtGroup[];
  search: string;
  onSearchChange: (v: string) => void;
  netBalance: number;
  totalNegativeMonthly: number;
  onSelect: (name: string) => void;
  onOpenHistory: () => void;
}

function SummaryView({
  groups,
  search,
  onSearchChange,
  netBalance,
  totalNegativeMonthly,
  onSelect,
  onOpenHistory,
}: SummaryViewProps) {
  const { t, isRTL } = useLanguage();
  const { theme } = useTheme();
  const { headerHeight, navbarHeight } = useChrome();

  return (
    <Animated.View
      entering={(isRTL ? SlideInRight : SlideInLeft).duration(280)}
      style={{ flex: 1 }}
    >
      <FlashList
        data={groups}
        keyExtractor={(item) => item.name}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: headerHeight + 20,
          paddingBottom: navbarHeight + 45,
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: theme.textPrimary }}>
                  {t('debts.title')}
                </Text>
                <Text style={{ fontSize: 12, color: theme.textTertiary, marginTop: 4 }}>
                  {t('debts.subtitle')}
                </Text>
              </View>
              <IconButton
                icon={History}
                accessibilityLabel={t('debts.viewHistory')}
                onPress={onOpenHistory}
                variant="tinted"
              />
            </View>
            <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 14 }} />

            <MoneyStatCard
              label={t('debts.netBalance')}
              amount={netBalance}
              color={netBalance >= 0 ? SEMANTIC.positive : SEMANTIC.negative}
              footer={
                totalNegativeMonthly > 0 ? (
                  // A locally-styled tinted/translucent pill rather than the
                  // shared Badge primitive here — Badge's variants are tuned
                  // for the compact category/period chips used everywhere
                  // else, and this stat card calls for the two-layer
                  // background+border treatment instead. Uses the theme's own
                  // accent rather than a fixed color so it stays correct
                  // across all four palettes.
                  <View
                    style={{
                      alignSelf: 'center',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      paddingVertical: 5,
                      paddingHorizontal: 12,
                      borderRadius: RADII.pill,
                      backgroundColor: `rgba(${theme.glow.a},0.12)`,
                      borderWidth: 1,
                      borderColor: `rgba(${theme.glow.a},0.28)`,
                    }}
                  >
                    <Text style={{ fontSize: 10.5, fontWeight: '700', color: theme.accent2 }}>
                      {t('debts.monthlyInstallmentsLabel')}
                    </Text>
                    <MoneyAmount
                      amount={totalNegativeMonthly}
                      color={theme.accent2}
                      size={14}
                    />
                  </View>
                ) : undefined
              }
            />

            <View style={{ marginTop: 16 }}>
              <SearchInput
                value={search}
                onChangeText={onSearchChange}
                placeholder={t('debts.searchPlaceholder')}
              />
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyState caption={t('debts.empty')} />}
        renderItem={({ item, index }) => (
          <ListCard isLast={index === groups.length - 1}>
            <PersonRow group={item} onPress={() => onSelect(item.name)} />
          </ListCard>
        )}
      />
    </Animated.View>
  );
}

function PersonRow({ group, onPress }: { group: DebtGroup; onPress: () => void }) {
  const { t } = useLanguage();
  const { theme } = useTheme();

  return (
    <ListRow
      onPress={onPress}
      showBottomBorder={false}
      leading={<Avatar name={group.name} photoUri={group.avatar} ring={group.type} size={44} />}
      title={group.name}
      subtitle={
        group.phone ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 3,
              marginTop: 2,
            }}
          >
            <BrandGlyph slug="whatsapp" size={10} />
            <Text
              numberOfLines={1}
              style={{ fontSize: 10.5, color: theme.textTertiary, flexShrink: 1 }}
            >
              {group.phone}
            </Text>
          </View>
        ) : undefined
      }
      trailing={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MoneyAmount amount={group.totalNet} color={netColor(group.type, theme)} size={17} />
          <IconButton
            icon={ChevronRight}
            accessibilityLabel={t('debts.viewPerson')}
            directional
            size={22}
            iconSize={11}
          />
        </View>
      }
    />
  );
}

interface DetailViewProps {
  group: DebtGroup;
  onBack: () => void;
  onEdit: (debt: Debt) => void;
  onWhatsApp: () => void;
  whatsAppError: string;
  onDismissWhatsAppError: () => void;
  onOpenHistory: () => void;
}

function DetailView({
  group,
  onBack,
  onEdit,
  onWhatsApp,
  whatsAppError,
  onDismissWhatsAppError,
  onOpenHistory,
}: DetailViewProps) {
  const { t, isRTL } = useLanguage();
  const { theme } = useTheme();
  const { headerHeight, navbarHeight } = useChrome();
  // Data and visibility kept separate (mirrors DebtModal's own
  // editingDebt/modalOpen split) so the sheet's content doesn't blank out
  // mid-close — `detailTarget` only ever changes when a new row is tapped.
  const [detailTarget, setDetailTarget] = useState<Debt | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const header = (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton
          icon={ArrowLeft}
          accessibilityLabel={t('settings.back')}
          onPress={onBack}
          directional
          variant="tinted"
        />
        <IconButton
          icon={History}
          accessibilityLabel={t('debts.viewHistory')}
          onPress={onOpenHistory}
          variant="tinted"
        />
      </View>

      <View style={{ alignItems: 'center', gap: 10, marginTop: 4 }}>
        <Avatar name={group.name} photoUri={group.avatar} ring={group.type} size={96} />
        <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: theme.textPrimary }}>
          {group.name}
        </Text>

        {group.phone || group.email || group.company ? (
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}
          >
            {group.phone ? (
              <Pressable onPress={onWhatsApp} style={chipStyle(theme)}>
                <BrandGlyph slug="whatsapp" size={11} />
                <Text style={chipTextStyle(theme)}>{group.phone}</Text>
              </Pressable>
            ) : null}
            {group.email ? (
              <View style={chipStyle(theme)}>
                <Mail size={11} color={theme.textTertiary} />
                <Text style={chipTextStyle(theme)}>{group.email}</Text>
              </View>
            ) : null}
            {group.company ? (
              <View style={chipStyle(theme)}>
                <Building2 size={11} color={theme.textTertiary} />
                <Text style={chipTextStyle(theme)}>{group.company}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {whatsAppError ? (
          <InlineBanner
            kind="error"
            message={whatsAppError}
            onDismiss={onDismissWhatsAppError}
            autoDismissMs={4000}
          />
        ) : null}

        <View
          style={{
            width: '100%',
            borderRadius: RADII.statCard,
            padding: 18,
            alignItems: 'center',
            backgroundColor: `${netColor(group.type, theme)}1A`,
          }}
        >
          <Text
            style={{
              fontSize: 10.5,
              fontWeight: '700',
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              color: netColor(group.type, theme),
            }}
          >
            {group.type === 'settled' ? t('debts.status.settled') : t(`debts.type.${group.type}`)}
          </Text>
          <View style={{ marginTop: 6 }}>
            <MoneyAmount amount={group.totalNet} color={netColor(group.type, theme)} size={26} />
          </View>
        </View>
      </View>

      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: theme.textTertiary,
          marginTop: 18,
          marginBottom: 10,
        }}
      >
        {t('debts.history')}
      </Text>
    </View>
  );

  return (
    <Animated.View
      entering={(isRTL ? SlideInLeft : SlideInRight).duration(280)}
      style={{ flex: 1 }}
    >
      <FlashList
        data={group.transactions}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: headerHeight + 16,
          paddingBottom: navbarHeight + 40,
        }}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => (
          <ListCard isLast={index === group.transactions.length - 1}>
            <TransactionRow
              debt={item}
              onPress={() => {
                setDetailTarget(item);
                setDetailOpen(true);
              }}
              onEditPress={() => onEdit(item)}
            />
          </ListCard>
        )}
      />

      <TransactionDetailSheet
        visible={detailOpen}
        debt={detailTarget}
        onClose={() => setDetailOpen(false)}
        onEdit={() => {
          setDetailOpen(false);
          if (detailTarget) onEdit(detailTarget);
        }}
      />
    </Animated.View>
  );
}

/** Same row shape as Expenses' ExpenseRow (CLAUDE.md rule 4) — one leading
 * tile, title+subtitle, trailing amount, no per-row edit/delete icons.
 * Tapping the row opens a quick read-only detail sheet (notes, installment
 * plan); the trailing chevron is its own tap target that jumps straight into
 * DebtModal's edit form — RN's touch responder gives the innermost Pressable
 * (the IconButton) the touch, so it doesn't also trigger the row's own
 * onPress. */
function TransactionRow({
  debt,
  onPress,
  onEditPress,
}: {
  debt: Debt;
  onPress: () => void;
  onEditPress: () => void;
}) {
  const { t } = useLanguage();
  const isPositive = debt.type === 'positive';

  return (
    <ListRow
      onPress={onPress}
      showBottomBorder={false}
      leading={
        <IconTile
          size={40}
          backgroundColor={isPositive ? 'rgba(52,211,153,0.14)' : 'rgba(251,113,133,0.14)'}
        >
          {isPositive ? (
            <TrendingUp size={17} color={SEMANTIC.positive} />
          ) : (
            <TrendingDown size={17} color={SEMANTIC.negative} />
          )}
        </IconTile>
      }
      title={t(isPositive ? 'debts.type.positive' : 'debts.type.negative')}
      subtitle={debt.date}
      trailing={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MoneyAmount
            amount={debt.amount}
            currencyCode={debt.currency ?? 'SAR'}
            color={isPositive ? SEMANTIC.positive : SEMANTIC.negative}
            size={17}
          />
          <IconButton
            icon={ChevronRight}
            accessibilityLabel={t('debts.editTransaction')}
            onPress={onEditPress}
            directional
            size={22}
            iconSize={11}
          />
        </View>
      }
    />
  );
}

/** Read-only "what is this transaction" sheet — notes and installment plan
 * laid out to actually be read at a glance, not the plain stacked form
 * fields DebtModal needs for editing. One Edit button hands off to that
 * form when you actually want to change something. `debt` stays set across
 * the close animation (mirrors DebtModal's editingDebt/visible split) so the
 * sheet's content doesn't blank out mid-slide-down. */
function TransactionDetailSheet({
  visible,
  debt,
  onClose,
  onEdit,
}: {
  visible: boolean;
  debt: Debt | null;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { t } = useLanguage();
  const { theme } = useTheme();

  if (!debt) return <GlassModal visible={visible} onClose={onClose}>{null}</GlassModal>;

  const isPositive = debt.type === 'positive';
  const hasInstallment = debt.type === 'negative' && debt.monthlyPayment > 0;
  const accent = isPositive ? SEMANTIC.positive : SEMANTIC.negative;

  return (
    <GlassModal
      visible={visible}
      onClose={onClose}
      title={t(isPositive ? 'debts.type.positive' : 'debts.type.negative')}
    >
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 4 }}>
        <IconTile size={52} backgroundColor={isPositive ? 'rgba(52,211,153,0.14)' : 'rgba(251,113,133,0.14)'}>
          {isPositive ? (
            <TrendingUp size={22} color={SEMANTIC.positive} />
          ) : (
            <TrendingDown size={22} color={SEMANTIC.negative} />
          )}
        </IconTile>
        <MoneyAmount amount={debt.amount} currencyCode={debt.currency ?? 'SAR'} color={accent} size={30} />
        <Text style={{ fontSize: 12, color: theme.textTertiary }}>{debt.date}</Text>
      </View>

      {debt.notes ? (
        <View
          style={{
            flexDirection: 'row',
            gap: 10,
            padding: 14,
            borderRadius: RADII.field,
            backgroundColor: theme.surfaceAlt,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <StickyNote size={15} color={theme.textTertiary} />
          <Text style={{ flex: 1, fontSize: 12.5, color: theme.textSecondary, lineHeight: 18 }}>
            {debt.notes}
          </Text>
        </View>
      ) : null}

      {hasInstallment ? (
        <View
          style={{
            gap: 12,
            padding: 14,
            borderRadius: RADII.field,
            backgroundColor: `${SEMANTIC.negative}0F`,
            borderWidth: 1,
            borderColor: `${SEMANTIC.negative}33`,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <CalendarClock size={14} color={SEMANTIC.negative} />
            <Text
              style={{
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                color: SEMANTIC.negative,
              }}
            >
              {t('debtModal.installmentSectionTitle')}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 11.5, color: theme.textSecondary }}>
              {t('debts.installmentDetailsSuffix')}
            </Text>
            <MoneyAmount
              amount={debt.monthlyPayment}
              currencyCode={debt.currency ?? 'SAR'}
              color={theme.textPrimary}
              size={15}
            />
          </View>

          <View style={{ height: 1, backgroundColor: theme.borderSoft }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 11.5, color: theme.textSecondary }}>{debt.startDate}</Text>
            <Text style={{ fontSize: 11, color: theme.textTertiary }}>→</Text>
            <Text style={{ fontSize: 11.5, color: theme.textSecondary }}>
              {debt.endDate || t('debts.noEndDate')}
            </Text>
          </View>
        </View>
      ) : null}

      <GradientButton label={t('debts.editTransaction')} onPress={onEdit} />
    </GlassModal>
  );
}

interface HistoryViewProps {
  debts: Debt[];
  /** null = flat, all-people history; a name = filtered to just that person. */
  personName: string | null;
  onBack: () => void;
  onForget: (debt: Debt) => void;
}

/** Deleted debts, bank-app "all transactions" style — newest-first, either
 * across every person (from the summary view) or filtered to one person
 * (from their detail view) — kept until permanently removed here (1.5). */
function HistoryView({ debts, personName, onBack, onForget }: HistoryViewProps) {
  const { t, isRTL } = useLanguage();
  const { theme } = useTheme();
  const { headerHeight, navbarHeight } = useChrome();

  const header = (
    <View style={{ marginBottom: 16 }}>
      <IconButton
        icon={ArrowLeft}
        accessibilityLabel={t('settings.back')}
        onPress={onBack}
        directional
        variant="tinted"
      />
      <Text
        style={{ fontFamily: FONTS.display, fontSize: 20, color: theme.textPrimary, marginTop: 12 }}
      >
        {personName ? t('debts.historyTitleFor', { name: personName }) : t('debts.historyTitle')}
      </Text>
      <Text style={{ fontSize: 12, color: theme.textTertiary, marginTop: 4 }}>
        {t('debts.historySubtitle')}
      </Text>
    </View>
  );

  return (
    <Animated.View
      entering={(isRTL ? SlideInLeft : SlideInRight).duration(280)}
      style={{ flex: 1 }}
    >
      <FlashList
        data={debts}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: headerHeight + 16,
          paddingBottom: navbarHeight + 40,
        }}
        ListHeaderComponent={header}
        ListEmptyComponent={<EmptyState icon={History} caption={t('debts.historyEmpty')} />}
        renderItem={({ item, index }) => {
          const isFirst = index === 0;
          const isLast = index === debts.length - 1;
          return (
            <View
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                borderLeftWidth: 1,
                borderRightWidth: 1,
                borderTopWidth: isFirst ? 1 : 0,
                borderBottomWidth: isLast ? 1 : 0,
                borderTopLeftRadius: isFirst ? RADII.txList : 0,
                borderTopRightRadius: isFirst ? RADII.txList : 0,
                borderBottomLeftRadius: isLast ? RADII.txList : 0,
                borderBottomRightRadius: isLast ? RADII.txList : 0,
              }}
            >
              <HistoryRow debt={item} showBottomBorder={!isLast} onForget={() => onForget(item)} />
            </View>
          );
        }}
      />
    </Animated.View>
  );
}

function HistoryRow({
  debt,
  showBottomBorder,
  onForget,
}: {
  debt: Debt;
  showBottomBorder: boolean;
  onForget: () => void;
}) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isPositive = debt.type === 'positive';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        borderBottomWidth: showBottomBorder ? 1 : 0,
        borderBottomColor: theme.borderSoft,
      }}
    >
      <IconTile
        size={34}
        backgroundColor={isPositive ? 'rgba(52,211,153,0.14)' : 'rgba(251,113,133,0.14)'}
      >
        {isPositive ? (
          <TrendingUp size={15} color={SEMANTIC.positive} />
        ) : (
          <TrendingDown size={15} color={SEMANTIC.negative} />
        )}
      </IconTile>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 12.5, fontWeight: '700', color: theme.textPrimary }}
        >
          {debt.name}
        </Text>
        <Text style={{ fontSize: 10.5, color: theme.textTertiary, marginTop: 1 }}>
          {t('debts.deletedOn', { date: (debt.deletedAt ?? '').slice(0, 10) })}
        </Text>
      </View>
      <MoneyAmount
        amount={debt.amount}
        currencyCode={debt.currency ?? 'SAR'}
        color={isPositive ? SEMANTIC.positive : SEMANTIC.negative}
        size={17}
      />
      <IconButton
        icon={Trash2}
        accessibilityLabel={t('debts.deleteForever')}
        size={28}
        iconSize={12}
        onPress={onForget}
      />
    </View>
  );
}

function chipStyle(theme: ThemeShape) {
  return {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADII.pill,
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.border,
  };
}

function chipTextStyle(theme: ThemeShape) {
  return { fontSize: 10.5, color: theme.textSecondary } as const;
}
