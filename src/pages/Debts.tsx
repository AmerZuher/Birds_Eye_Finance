import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import Animated, { SlideInLeft, SlideInRight } from 'react-native-reanimated';
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  CircleCheck,
  History,
  Mail,
  Pencil,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react-native';

import { BrandGlyph } from '@/components/BrandGlyph';
import { DebtDetailSheet, debtStatusBadge } from '@/components/DebtDetailSheet';
import { DebtModal } from '@/components/DebtModal';
import type { DebtPrefill } from '@/components/DebtModal';
import { EditPersonSheet } from '@/components/EditPersonSheet';
import type { PersonDetailField } from '@/components/EditPersonSheet';
import { SectionLabel } from '@/components/FormField';
import { MoneyStatCard } from '@/components/MoneyStatCard';
import { PageTransition } from '@/components/PageTransition';
import { Avatar } from '@/components/ui/Avatar';
import { Badge, FilterChip } from '@/components/ui/Badge';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { IconTile } from '@/components/ui/IconTile';
import { InlineBanner } from '@/components/ui/InlineBanner';
import type { BannerKind } from '@/components/ui/InlineBanner';
import { ListCard } from '@/components/ui/ListCard';
import { ListRow } from '@/components/ui/ListRow';
import { MoneyAmount } from '@/components/ui/MoneyAmount';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SearchInput } from '@/components/ui/SearchInput';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useChrome } from '@/context/ChromeContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useDebts } from '@/context/DebtsContext';
import type { DebtGroup, DebtGroupType, DebtView } from '@/context/DebtsContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeShape } from '@/constants/theme';
import { FONTS, RADII, SEMANTIC } from '@/constants/theme';
import type { Debt } from '@/db/schema';
import { formatDebtId, isMoneyZero } from '@/lib/debtStatus';
import { HIDDEN_SCROLLBARS } from '@/lib/scroll';
import { withAlpha } from '@/utils/color';
import { openWhatsApp } from '@/utils/whatsapp';

type HistoryTab = 'settled' | 'deleted';

function matchesSearch(group: DebtGroup, query: string): boolean {
  if (group.name.toLowerCase().includes(query)) return true;
  if (group.phone?.toLowerCase().includes(query)) return true;
  if (group.email?.toLowerCase().includes(query)) return true;
  if (group.company?.toLowerCase().includes(query)) return true;
  // "#0042", "0042" and "42" all find debt 42.
  const idQuery = query.replace(/^#/, '').replace(/^0+(?=\d)/, '');
  const isIdQuery = /^\d+$/.test(idQuery);
  return group.transactions.some(
    (tx) =>
      tx.notes?.toLowerCase().includes(query) ||
      tx.date.toLowerCase().includes(query) ||
      String(tx.amount).toLowerCase().includes(query) ||
      (isIdQuery && String(tx.id) === idQuery),
  );
}

function netColor(type: DebtGroupType, theme: ThemeShape): string {
  if (type === 'positive') return SEMANTIC.positive;
  if (type === 'negative') return SEMANTIC.negative;
  return theme.textSecondary;
}

function typeAccent(type: Debt['type']): string {
  return type === 'positive' ? SEMANTIC.positive : SEMANTIC.negative;
}

function TypeTile({ type, size }: { type: Debt['type']; size: number }) {
  const accent = typeAccent(type);
  const Icon = type === 'positive' ? TrendingUp : TrendingDown;
  return (
    <IconTile size={size} backgroundColor={withAlpha(accent, 0.14)}>
      <Icon size={Math.round(size * 0.42)} color={accent} />
    </IconTile>
  );
}

export default function Debts() {
  const { t } = useLanguage();
  const { setFabHandler, consumeDebtCreateRequest } = useChrome();
  const { formatMoney, formatOriginalMoney } = useCurrency();
  const {
    groupedDebts,
    debtsCalculations,
    settledDebts,
    deletedDebts,
    peopleById,
    settledCountByPerson,
    deleteDebt,
    permanentlyDeleteDebt,
    settleAll,
  } = useDebts();

  const [search, setSearch] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  // null = everyone's history (from the summary view); an id = one person's.
  const [historyPersonId, setHistoryPersonId] = useState<number | null>(null);
  const [historyTab, setHistoryTab] = useState<HistoryTab>('settled');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<DebtView | null>(null);
  const [createPrefill, setCreatePrefill] = useState<DebtPrefill | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DebtView | null>(null);
  const [forgetTarget, setForgetTarget] = useState<Debt | null>(null);
  // Data and visibility kept separate so a sheet's content doesn't blank out mid-close.
  const [detailDebtId, setDetailDebtId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editPersonOpen, setEditPersonOpen] = useState(false);
  const [editPersonFocus, setEditPersonFocus] = useState<PersonDetailField | null>(null);
  const [settleAllOpen, setSettleAllOpen] = useState(false);
  const [whatsAppError, setWhatsAppError] = useState('');
  const [banner, setBanner] = useState<{ kind: BannerKind; message: string } | null>(null);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groupedDebts;
    return groupedDebts.filter((group) => matchesSearch(group, q));
  }, [groupedDebts, search]);

  // Only people with active debts have a group. When the last one settles or
  // is deleted, selectedGroup resolves to null and the detail view closes on
  // its own (FEATURE_SPEC 1.4) — no effect needed to reset the selection.
  const selectedGroup = useMemo(
    () => groupedDebts.find((g) => g.personId === selectedPersonId) ?? null,
    [groupedDebts, selectedPersonId],
  );
  const selectedPerson =
    selectedPersonId != null ? (peopleById.get(selectedPersonId) ?? null) : null;

  const historySettled = useMemo(
    () =>
      historyPersonId == null
        ? settledDebts
        : settledDebts.filter((d) => d.personId === historyPersonId),
    [settledDebts, historyPersonId],
  );
  const historyDeleted = useMemo(
    () =>
      historyPersonId == null
        ? deletedDebts
        : deletedDebts.filter((d) => d.personId === historyPersonId),
    [deletedDebts, historyPersonId],
  );

  // Android back: detail → list (FEATURE_SPEC 0.2). Keyed off selectedGroup
  // so it unregisters the instant the group disappears.
  useEffect(() => {
    if (!selectedGroup) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelectedPersonId(null);
      return true;
    });
    return () => sub.remove();
  }, [selectedGroup]);

  // Same for History. Registered after the detail listener when opened from a
  // detail view, so RN's LIFO back stack closes History first.
  useEffect(() => {
    if (!historyOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setHistoryOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [historyOpen]);

  // From a person's page the FAB creates a debt for that person.
  const openCreateModal = useCallback(() => {
    setEditingDebt(null);
    setCreatePrefill(selectedGroup ? { personId: selectedGroup.personId } : null);
    setModalOpen(true);
  }, [selectedGroup]);

  // Registered on focus, not mount — tab screens stay mounted, so a mount-time
  // effect would leave the last-visited tab owning the FAB forever. Pressing
  // the FAB elsewhere navigates here and leaves a request to pick up.
  useFocusEffect(
    useCallback(() => {
      setFabHandler(openCreateModal);
      if (consumeDebtCreateRequest()) openCreateModal();
    }, [setFabHandler, openCreateModal, consumeDebtCreateRequest]),
  );

  const openEditModal = (debt: DebtView) => {
    setEditingDebt(debt);
    setModalOpen(true);
  };

  const openDetail = (debtId: number) => {
    setDetailDebtId(debtId);
    setDetailOpen(true);
  };

  const openHistory = (personId: number | null) => {
    setHistoryPersonId(personId);
    setHistoryTab('settled');
    setHistoryOpen(true);
  };

  const openEditPerson = (field: PersonDetailField | null) => {
    setEditPersonFocus(field);
    setEditPersonOpen(true);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteDebt(deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleForget = () => {
    if (!forgetTarget) return;
    permanentlyDeleteDebt(forgetTarget.id);
    setForgetTarget(null);
  };

  const handleSettleAll = () => {
    setSettleAllOpen(false);
    if (!selectedGroup) return;
    settleAll(selectedGroup.personId, t('debts.settleAllNote'));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setBanner({
      kind: 'success',
      message: t('debts.settledAllBanner', { name: selectedGroup.name }),
    });
  };

  const handleWhatsApp = async () => {
    if (!selectedGroup?.phone) return;
    const lines = selectedGroup.transactions.map((tx) => {
      const vars = {
        id: formatDebtId(tx.id),
        type: t(tx.type === 'positive' ? 'debts.type.positive' : 'debts.type.negative'),
        amount: formatOriginalMoney(tx.outstanding, tx.currency ?? 'SAR'),
        date: tx.date,
      };
      return tx.date ? t('debts.whatsapp.lineWithDate', vars) : t('debts.whatsapp.line', vars);
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
            tab={historyTab}
            onTabChange={setHistoryTab}
            settled={historySettled}
            deleted={historyDeleted}
            personName={
              historyPersonId != null ? (peopleById.get(historyPersonId)?.name ?? null) : null
            }
            onBack={() => setHistoryOpen(false)}
            onOpenDebt={openDetail}
            onForget={setForgetTarget}
          />
        ) : selectedGroup ? (
          <DetailView
            group={selectedGroup}
            settledCount={settledCountByPerson.get(selectedGroup.personId) ?? 0}
            onBack={() => setSelectedPersonId(null)}
            onOpenDebt={openDetail}
            onEditDebt={openEditModal}
            onWhatsApp={handleWhatsApp}
            whatsAppError={whatsAppError}
            onDismissWhatsAppError={() => setWhatsAppError('')}
            onOpenHistory={() => openHistory(selectedGroup.personId)}
            onEditPerson={openEditPerson}
            onSettleAll={() => setSettleAllOpen(true)}
          />
        ) : (
          <SummaryView
            groups={filteredGroups}
            search={search}
            onSearchChange={setSearch}
            netBalance={netBalance}
            totalNegativeMonthly={debtsCalculations.totalNegativeMonthly}
            onSelect={setSelectedPersonId}
            onOpenHistory={() => openHistory(null)}
            banner={banner}
            onDismissBanner={() => setBanner(null)}
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

      <DebtDetailSheet
        visible={detailOpen}
        debtId={detailDebtId}
        onClose={() => setDetailOpen(false)}
        onEdit={(debt) => {
          setDetailOpen(false);
          openEditModal(debt);
        }}
      />

      <EditPersonSheet
        visible={editPersonOpen}
        onClose={() => setEditPersonOpen(false)}
        person={selectedPerson}
        focusField={editPersonFocus}
        onMerged={setSelectedPersonId}
      />

      <ConfirmModal
        visible={!!deleteTarget}
        title={t('debts.deleteTitle')}
        subtitle={
          deleteTarget ? `${formatDebtId(deleteTarget.id)} · ${deleteTarget.name}` : undefined
        }
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

      <ConfirmModal
        visible={settleAllOpen}
        title={t('debts.settleAllTitle', { name: selectedGroup?.name ?? '' })}
        subtitle={t('debts.settleAllSubtitle')}
        onCancel={() => setSettleAllOpen(false)}
        onConfirm={handleSettleAll}
        confirmLabel={t('debts.settleAll')}
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
  onSelect: (personId: number) => void;
  onOpenHistory: () => void;
  banner: { kind: BannerKind; message: string } | null;
  onDismissBanner: () => void;
}

function SummaryView({
  groups,
  search,
  onSearchChange,
  netBalance,
  totalNegativeMonthly,
  onSelect,
  onOpenHistory,
  banner,
  onDismissBanner,
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
        keyExtractor={(item) => String(item.personId)}
        {...HIDDEN_SCROLLBARS}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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

            {banner ? (
              <View style={{ marginBottom: 14 }}>
                <InlineBanner
                  kind={banner.kind}
                  message={banner.message}
                  onDismiss={onDismissBanner}
                  autoDismissMs={4000}
                />
              </View>
            ) : null}

            <MoneyStatCard
              label={t('debts.netBalance')}
              amount={netBalance}
              color={netBalance >= 0 ? SEMANTIC.positive : SEMANTIC.negative}
              footer={
                totalNegativeMonthly > 0 ? (
                  <View
                    style={{
                      alignSelf: 'center',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Badge label={t('debts.monthlyInstallmentsLabel')} variant="accent" />
                    <MoneyAmount amount={totalNegativeMonthly} color={theme.accent2} size={14} />
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
            <PersonRow group={item} onPress={() => onSelect(item.personId)} />
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
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
            onPress={onPress}
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
  settledCount: number;
  onBack: () => void;
  onOpenDebt: (debtId: number) => void;
  onEditDebt: (debt: DebtView) => void;
  onWhatsApp: () => void;
  whatsAppError: string;
  onDismissWhatsAppError: () => void;
  onOpenHistory: () => void;
  onEditPerson: (field: PersonDetailField | null) => void;
  onSettleAll: () => void;
}

function DetailView({
  group,
  settledCount,
  onBack,
  onOpenDebt,
  onEditDebt,
  onWhatsApp,
  whatsAppError,
  onDismissWhatsAppError,
  onOpenHistory,
  onEditPerson,
  onSettleAll,
}: DetailViewProps) {
  const { t, isRTL } = useLanguage();
  const { theme } = useTheme();
  const { headerHeight, navbarHeight } = useChrome();
  const tint = netColor(group.type, theme);
  const addIcon = <Plus size={11} color={theme.textTertiary} />;

  const header = (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton
          icon={ArrowLeft}
          accessibilityLabel={t('settings.back')}
          onPress={onBack}
          directional
          variant="tinted"
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton
            icon={Pencil}
            accessibilityLabel={t('debts.editPerson')}
            onPress={() => onEditPerson(null)}
            variant="tinted"
          />
          <IconButton
            icon={History}
            accessibilityLabel={t('debts.viewHistory')}
            onPress={onOpenHistory}
            variant="tinted"
          />
        </View>
      </View>

      <View style={{ alignItems: 'center', gap: 10, marginTop: 4 }}>
        <Avatar name={group.name} photoUri={group.avatar} ring={group.type} size={96} />
        <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: theme.textPrimary }}>
          {group.name}
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {group.phone ? (
            <FilterChip
              leading={<BrandGlyph slug="whatsapp" size={11} />}
              label={group.phone}
              ltr
              onPress={onWhatsApp}
            />
          ) : (
            <FilterChip
              dashed
              leading={addIcon}
              label={t('debts.addPhone')}
              onPress={() => onEditPerson('phone')}
            />
          )}
          {group.email ? (
            <FilterChip
              leading={<Mail size={11} color={theme.textTertiary} />}
              label={group.email}
              ltr
              onPress={() => onEditPerson('email')}
            />
          ) : (
            <FilterChip
              dashed
              leading={addIcon}
              label={t('debts.addEmail')}
              onPress={() => onEditPerson('email')}
            />
          )}
          {group.company ? (
            <FilterChip
              leading={<Building2 size={11} color={theme.textTertiary} />}
              label={group.company}
              onPress={() => onEditPerson('company')}
            />
          ) : (
            <FilterChip
              dashed
              leading={addIcon}
              label={t('debts.addCompany')}
              onPress={() => onEditPerson('company')}
            />
          )}
        </View>

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
            backgroundColor: withAlpha(tint, 0.1),
          }}
        >
          <Text
            style={{
              fontSize: 10.5,
              fontWeight: '700',
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              color: tint,
            }}
          >
            {group.type === 'settled' ? t('debts.status.settled') : t(`debts.type.${group.type}`)}
          </Text>
          <View style={{ marginTop: 6 }}>
            <MoneyAmount amount={group.totalNet} color={tint} size={26} />
          </View>
        </View>

        {settledCount > 0 ? (
          <SecondaryButton
            variant="link"
            icon={CircleCheck}
            label={t('debts.settledCount', { count: settledCount })}
            onPress={onOpenHistory}
          />
        ) : null}

        {isMoneyZero(group.totalNet) ? (
          <View style={{ width: '100%', gap: 8 }}>
            <Text style={{ fontSize: 11.5, color: theme.textTertiary, textAlign: 'center' }}>
              {t('debts.settleAllHint')}
            </Text>
            <SecondaryButton
              icon={CircleCheck}
              label={t('debts.settleAll')}
              onPress={onSettleAll}
            />
          </View>
        ) : null}
      </View>

      <View style={{ marginTop: 18, marginBottom: 10 }}>
        <SectionLabel>{t('debts.activeDebts')}</SectionLabel>
      </View>
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
        {...HIDDEN_SCROLLBARS}
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
              onPress={() => onOpenDebt(item.id)}
              onEditPress={() => onEditDebt(item)}
            />
          </ListCard>
        )}
      />
    </Animated.View>
  );
}

/** One active debt: its ID, the payment status right under it, and what's still outstanding. */
function TransactionRow({
  debt,
  onPress,
  onEditPress,
}: {
  debt: DebtView;
  onPress: () => void;
  onEditPress: () => void;
}) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { formatOriginalMoney } = useCurrency();
  const currency = debt.currency ?? 'SAR';
  const badge = debtStatusBadge(debt.status, t);

  return (
    <ListRow
      onPress={onPress}
      showBottomBorder={false}
      leading={<TypeTile type={debt.type} size={40} />}
      title={formatDebtId(debt.id)}
      subtitle={
        <View style={{ gap: 6, marginTop: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Badge label={badge.label} variant={badge.variant} />
            <Text
              numberOfLines={1}
              style={{ flexShrink: 1, fontSize: 10.5, color: theme.textTertiary }}
            >
              {`${t(`debts.type.${debt.type}`)} · ${debt.date}`}
            </Text>
          </View>
          {debt.status === 'partial' ? <ProgressBar progress={debt.progress} height={4} /> : null}
        </View>
      }
      trailing={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ alignItems: 'flex-end' }}>
            <MoneyAmount
              amount={debt.outstanding}
              currencyCode={currency}
              color={typeAccent(debt.type)}
              size={17}
            />
            {debt.status === 'partial' ? (
              <Text style={{ fontSize: 9.5, color: theme.textTertiary }}>
                {t('debts.ofOriginal', { amount: formatOriginalMoney(debt.amount, currency) })}
              </Text>
            ) : null}
          </View>
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

interface HistoryViewProps {
  tab: HistoryTab;
  onTabChange: (tab: HistoryTab) => void;
  settled: DebtView[];
  deleted: Debt[];
  /** null = everyone; a name = one person's history. */
  personName: string | null;
  onBack: () => void;
  onOpenDebt: (debtId: number) => void;
  onForget: (debt: Debt) => void;
}

/** Settled and deleted debts (FEATURE_SPEC 1.9), newest first. */
function HistoryView({
  tab,
  onTabChange,
  settled,
  deleted,
  personName,
  onBack,
  onOpenDebt,
  onForget,
}: HistoryViewProps) {
  const { t, isRTL } = useLanguage();
  const { theme } = useTheme();
  const { headerHeight, navbarHeight } = useChrome();

  const header = (
    <View style={{ marginBottom: 16, gap: 12 }}>
      <IconButton
        icon={ArrowLeft}
        accessibilityLabel={t('settings.back')}
        onPress={onBack}
        directional
        variant="tinted"
      />
      <View>
        <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: theme.textPrimary }}>
          {personName ? t('debts.historyTitleFor', { name: personName }) : t('debts.historyTitle')}
        </Text>
        <Text style={{ fontSize: 12, color: theme.textTertiary, marginTop: 4 }}>
          {t('debts.historySubtitle')}
        </Text>
      </View>
      <SegmentedControl<HistoryTab>
        options={[
          { label: t('debts.historyTab.settled'), value: 'settled' },
          { label: t('debts.historyTab.deleted'), value: 'deleted' },
        ]}
        value={tab}
        onChange={onTabChange}
      />
    </View>
  );

  const contentContainerStyle = {
    paddingHorizontal: 16,
    paddingTop: headerHeight + 16,
    paddingBottom: navbarHeight + 40,
  };

  return (
    <Animated.View
      entering={(isRTL ? SlideInLeft : SlideInRight).duration(280)}
      style={{ flex: 1 }}
    >
      {tab === 'settled' ? (
        <FlashList
          key="settled"
          data={settled}
          keyExtractor={(item) => String(item.id)}
          {...HIDDEN_SCROLLBARS}
          contentContainerStyle={contentContainerStyle}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <EmptyState icon={CircleCheck} caption={t('debts.historyEmptySettled')} />
          }
          renderItem={({ item, index }) => (
            <ListCard isLast={index === settled.length - 1}>
              <ListRow
                showBottomBorder={false}
                onPress={() => onOpenDebt(item.id)}
                leading={<TypeTile type={item.type} size={36} />}
                title={item.name}
                subtitle={
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}
                  >
                    <Badge label={t('debts.status.paid')} variant="positive" />
                    <Text
                      numberOfLines={1}
                      style={{ flexShrink: 1, fontSize: 10.5, color: theme.textTertiary }}
                    >
                      {`${formatDebtId(item.id)} · ${t('debts.settledOn', { date: item.settledOn ?? '' })}`}
                    </Text>
                  </View>
                }
                trailing={
                  <MoneyAmount
                    amount={item.amount}
                    currencyCode={item.currency ?? 'SAR'}
                    color={typeAccent(item.type)}
                    size={16}
                  />
                }
              />
            </ListCard>
          )}
        />
      ) : (
        <FlashList
          key="deleted"
          data={deleted}
          keyExtractor={(item) => String(item.id)}
          {...HIDDEN_SCROLLBARS}
          contentContainerStyle={contentContainerStyle}
          ListHeaderComponent={header}
          ListEmptyComponent={<EmptyState icon={History} caption={t('debts.historyEmpty')} />}
          renderItem={({ item, index }) => (
            <ListCard isLast={index === deleted.length - 1}>
              <ListRow
                showBottomBorder={false}
                leading={<TypeTile type={item.type} size={36} />}
                title={item.name}
                subtitle={`${formatDebtId(item.id)} · ${t('debts.deletedOn', {
                  date: (item.deletedAt ?? '').slice(0, 10),
                })}`}
                trailing={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MoneyAmount
                      amount={item.amount}
                      currencyCode={item.currency ?? 'SAR'}
                      color={typeAccent(item.type)}
                      size={16}
                    />
                    <IconButton
                      icon={Trash2}
                      accessibilityLabel={t('debts.deleteForever')}
                      size={28}
                      iconSize={12}
                      onPress={() => onForget(item)}
                    />
                  </View>
                }
              />
            </ListCard>
          )}
        />
      )}
    </Animated.View>
  );
}
