import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { ChevronRight, StickyNote } from 'lucide-react-native';

import { PageTransition } from '@/components/PageTransition';
import { GlassModal } from '@/components/ui/GlassModal';
import { GradientButton } from '@/components/ui/GradientButton';
import { ListCard } from '@/components/ui/ListCard';
import { ListRow } from '@/components/ui/ListRow';
import { SearchInput } from '@/components/ui/SearchInput';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Badge, FilterChip } from '@/components/ui/Badge';
import { ExpenseModal } from '@/components/ExpenseModal';
import { ExpenseIconTile } from '@/components/ExpenseIconTile';
import { MoneyStatCard } from '@/components/MoneyStatCard';
import { MoneyAmount } from '@/components/ui/MoneyAmount';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { useChrome } from '@/context/ChromeContext';
import { useFinance } from '@/context/FinanceContext';
import type { Expense } from '@/db/schema';
import { FONTS, RADII, SEMANTIC } from '@/constants/theme';
import type { ExpenseCategory } from '@/utils/expenseIcon';
import { EXPENSE_CATEGORIES } from '@/utils/expenseIcon';
import { HIDDEN_SCROLLBARS } from '@/lib/scroll';

type CategoryFilter = 'all' | ExpenseCategory;

function matchesSearch(expense: Expense, query: string): boolean {
  if (expense.name.toLowerCase().includes(query)) return true;
  return !!expense.notes?.toLowerCase().includes(query);
}

export default function Expenses() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { headerHeight, navbarHeight, setFabHandler } = useChrome();
  const { expenses, totalExpenses, deleteExpense } = useFinance();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  // Data and visibility kept separate (mirrors DebtModal's own
  // editingDebt/modalOpen split) so the sheet's content doesn't blank out
  // mid-close — `detailTarget` only ever changes when a new row is tapped.
  const [detailTarget, setDetailTarget] = useState<Expense | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const openCreateModal = useCallback(() => {
    setEditingExpense(null);
    setModalOpen(true);
  }, []);

  // Registered on focus, not mount — see Debts.tsx for why (expo-router
  // keeps tab screens mounted after they've been visited).
  useFocusEffect(
    useCallback(() => {
      setFabHandler(openCreateModal);
    }, [setFabHandler, openCreateModal]),
  );

  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteExpense(deleteTarget.id);
    setDeleteTarget(null);
  };

  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses
      .filter((e) => categoryFilter === 'all' || e.category === categoryFilter)
      .filter((e) => !q || matchesSearch(e, q))
      .sort((a, b) => {
        const aUnconfigured = a.amount === 0;
        const bUnconfigured = b.amount === 0;
        if (aUnconfigured !== bUnconfigured) return aUnconfigured ? -1 : 1;
        return b.id - a.id;
      });
  }, [expenses, search, categoryFilter]);

  return (
    <>
      <PageTransition>
        <FlashList
          data={filteredExpenses}
          keyExtractor={(item) => String(item.id)}
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
              <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: theme.textPrimary }}>
                {t('expenses.title')}
              </Text>
              <Text style={{ fontSize: 12, color: theme.textTertiary, marginTop: 4 }}>
                {t('expenses.subtitle')}
              </Text>
              <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 14 }} />

              <MoneyStatCard
                label={t('expenses.monthlyTotal')}
                amount={totalExpenses}
                color={theme.accent2}
              />

              <View style={{ marginTop: 16 }}>
                <SearchInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t('expenses.searchPlaceholder')}
                />
              </View>

              <ScrollView
                horizontal
                {...HIDDEN_SCROLLBARS}
                contentContainerStyle={{ gap: 8, marginTop: 12, paddingEnd: 4 }}
              >
                <FilterChip
                  label={t('expenses.category.all')}
                  active={categoryFilter === 'all'}
                  onPress={() => setCategoryFilter('all')}
                />
                {EXPENSE_CATEGORIES.map((category) => (
                  <FilterChip
                    key={category}
                    label={t(`expenses.category.${category}`)}
                    active={categoryFilter === category}
                    onPress={() => setCategoryFilter(category)}
                  />
                ))}
              </ScrollView>
            </View>
          }
          ListEmptyComponent={<EmptyState caption={t('expenses.empty')} />}
          renderItem={({ item, index }) => (
            <ListCard isLast={index === filteredExpenses.length - 1}>
              <ExpenseRow
                expense={item}
                onPress={() => {
                  setDetailTarget(item);
                  setDetailOpen(true);
                }}
                onEditPress={() => openEditModal(item)}
              />
            </ListCard>
          )}
        />
      </PageTransition>

      <ExpenseDetailSheet
        visible={detailOpen}
        expense={detailTarget}
        onClose={() => setDetailOpen(false)}
        onEdit={() => {
          setDetailOpen(false);
          if (detailTarget) openEditModal(detailTarget);
        }}
      />

      <ExpenseModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        editingExpense={editingExpense}
        onRequestDelete={() => {
          setModalOpen(false);
          setDeleteTarget(editingExpense);
        }}
      />

      <ConfirmModal
        visible={!!deleteTarget}
        title={t('expenses.deleteTitle')}
        subtitle={deleteTarget?.name}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
      />
    </>
  );
}

interface ExpenseRowProps {
  expense: Expense;
  onPress: () => void;
  onEditPress: () => void;
}

/** Same shape as the Debts transaction row (CLAUDE.md rule 4): tapping the
 * row opens a quick read-only detail sheet (category/period, notes); the
 * trailing chevron is its own tap target that jumps straight into
 * ExpenseModal's edit form. Notes no longer render inline here — that
 * cramped, always-on text block under the divider is what the sheet
 * replaces. */
function ExpenseRow({ expense, onPress, onEditPress }: ExpenseRowProps) {
  const { t } = useLanguage();
  const unconfigured = expense.amount === 0;
  // FEATURE_SPEC 2.5: period Badge only when amount > 0.
  const showPeriodBadge = !unconfigured;

  return (
    <ListRow
      onPress={onPress}
      showBottomBorder={false}
      // 50, not the tile's own 34 default — Debts' PersonRow leading is
      // Avatar at size=44, but Avatar draws its ring 3px outside the given
      // size (see Avatar.tsx), so its real footprint is 44+6=50. IconTile
      // has no such padding: its `size` is the literal rendered box, so
      // matching Avatar's true footprint here (not its size prop) is what
      // makes the two rows the same height.
      leading={<ExpenseIconTile icon={expense.icon} name={expense.name} size={50} />}
      title={expense.name}
      subtitle={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <Badge label={t(`expenses.category.${expense.category}`)} variant="accent" />
          {showPeriodBadge ? <Badge label={t(`expenses.period.${expense.period}`)} /> : null}
        </View>
      }
      trailing={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {unconfigured ? (
            <Text style={{ fontSize: 11, fontWeight: '700', color: SEMANTIC.warning }}>
              {t('expenses.setupCost')}
            </Text>
          ) : (
            <MoneyAmount
              amount={expense.amount}
              currencyCode={expense.currency ?? 'SAR'}
              size={17}
            />
          )}
          <IconButton
            icon={ChevronRight}
            accessibilityLabel={t('expenses.editExpense')}
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

/** Read-only "what is this expense" sheet — mirrors Debts'
 * TransactionDetailSheet. One Edit button hands off to ExpenseModal when you
 * actually want to change something. `expense` stays set across the close
 * animation (mirrors ExpenseModal's editingExpense/visible split) so the
 * sheet's content doesn't blank out mid-slide-down. */
function ExpenseDetailSheet({
  visible,
  expense,
  onClose,
  onEdit,
}: {
  visible: boolean;
  expense: Expense | null;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { t } = useLanguage();
  const { theme } = useTheme();

  if (!expense)
    return (
      <GlassModal visible={visible} onClose={onClose}>
        {null}
      </GlassModal>
    );

  const unconfigured = expense.amount === 0;

  return (
    <GlassModal visible={visible} onClose={onClose} title={expense.name}>
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 4 }}>
        <ExpenseIconTile icon={expense.icon} name={expense.name} size={56} />
        {unconfigured ? (
          <Text style={{ fontSize: 13, fontWeight: '700', color: SEMANTIC.warning }}>
            {t('expenses.setupCost')}
          </Text>
        ) : (
          <MoneyAmount amount={expense.amount} currencyCode={expense.currency ?? 'SAR'} size={30} />
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Badge label={t(`expenses.category.${expense.category}`)} variant="accent" />
          {!unconfigured ? <Badge label={t(`expenses.period.${expense.period}`)} /> : null}
        </View>
      </View>

      {expense.notes ? (
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
            {expense.notes}
          </Text>
        </View>
      ) : null}

      <GradientButton label={t('expenses.editExpense')} onPress={onEdit} />
    </GlassModal>
  );
}
