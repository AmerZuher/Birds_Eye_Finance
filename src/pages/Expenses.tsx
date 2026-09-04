import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import Animated, { SlideInLeft, SlideInRight } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';

import { ListRow } from '@/components/ui/ListRow';
import { SearchInput } from '@/components/ui/SearchInput';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Badge, FilterChip } from '@/components/ui/Badge';
import { ExpenseModal } from '@/components/ExpenseModal';
import { ExpenseIconTile } from '@/components/ExpenseIconTile';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { useChrome } from '@/context/ChromeContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useFinance } from '@/context/FinanceContext';
import type { Expense } from '@/db/schema';
import { BORDER, FONTS, RADII, TEXT } from '@/constants/theme';
import type { ExpenseCategory } from '@/utils/expenseIcon';
import { EXPENSE_CATEGORIES } from '@/utils/expenseIcon';

type CategoryFilter = 'all' | ExpenseCategory;

function matchesSearch(expense: Expense, query: string): boolean {
  if (expense.name.toLowerCase().includes(query)) return true;
  return !!expense.notes?.toLowerCase().includes(query);
}

export default function Expenses() {
  const { t, isRTL } = useLanguage();
  const { theme } = useTheme();
  const { headerHeight, navbarHeight, setFabHandler } = useChrome();
  const { formatMoney } = useCurrency();
  const { expenses, totalExpenses, deleteExpense } = useFinance();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

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
      <Animated.View
        entering={(isRTL ? SlideInRight : SlideInLeft).duration(280)}
        style={{ flex: 1 }}
      >
        <FlashList
          data={filteredExpenses}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: headerHeight + 16,
            paddingBottom: navbarHeight + 90,
          }}
          ListHeaderComponent={
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: TEXT.primary }}>
                {t('expenses.title')}
              </Text>
              <Text style={{ fontSize: 12, color: TEXT.tertiary, marginTop: 4 }}>
                {t('expenses.subtitle')}
              </Text>
              <View style={{ height: 1, backgroundColor: BORDER.hairline, marginVertical: 14 }} />

              <LinearGradient
                colors={[theme.surface, theme.surfaceAlt]}
                style={{
                  borderRadius: RADII.card,
                  paddingVertical: 18,
                  paddingHorizontal: 16,
                  borderWidth: 1,
                  borderColor: BORDER.hairline,
                  alignItems: 'center',
                }}
              >
                <Text style={statLabelStyle}>{t('expenses.monthlyTotal')}</Text>
                <Text style={[statValueStyle, { color: theme.accent2 }]}>
                  {formatMoney(totalExpenses)}
                </Text>
              </LinearGradient>

              <View style={{ marginTop: 16 }}>
                <SearchInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t('expenses.searchPlaceholder')}
                />
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
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
          renderItem={({ item, index }) => {
            const isFirst = index === 0;
            const isLast = index === filteredExpenses.length - 1;
            return (
              <View
                style={{
                  backgroundColor: theme.surface,
                  borderColor: BORDER.hairline,
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
                <ExpenseRow
                  expense={item}
                  showBottomBorder={!isLast}
                  onPress={() => openEditModal(item)}
                />
              </View>
            );
          }}
        />
      </Animated.View>

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
  showBottomBorder: boolean;
  onPress: () => void;
}

function ExpenseRow({ expense, showBottomBorder, onPress }: ExpenseRowProps) {
  const { t } = useLanguage();
  const { formatOriginalMoney } = useCurrency();
  const unconfigured = expense.amount === 0;
  // FEATURE_SPEC 2.5: period Badge only when amount > 0.
  const showPeriodBadge = !unconfigured;

  return (
    <View>
      <ListRow
        onPress={onPress}
        showBottomBorder={showBottomBorder && !expense.notes}
        leading={<ExpenseIconTile icon={expense.icon} name={expense.name} size={38} />}
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
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#fbbf24' }}>
                {t('expenses.setupCost')}
              </Text>
            ) : (
              <Text style={{ fontFamily: FONTS.display, fontSize: 14, color: TEXT.primary }}>
                {formatOriginalMoney(expense.amount, expense.currency ?? 'SAR')}
              </Text>
            )}
            {/* Decorative, like the Debts person row's chevron — the row
                itself (via `onPress` above) is what's tappable, opening this
                expense in edit mode. */}
            <IconButton
              icon={ChevronRight}
              accessibilityLabel={t('expenses.editExpense')}
              directional
              size={22}
              iconSize={11}
            />
          </View>
        }
      />
      {expense.notes ? (
        <Text
          style={{
            fontSize: 11,
            color: TEXT.tertiary,
            paddingStart: 50,
            paddingEnd: 12,
            paddingBottom: 12,
            borderBottomWidth: showBottomBorder ? 1 : 0,
            borderBottomColor: BORDER.hairlineSoft,
          }}
        >
          {expense.notes}
        </Text>
      ) : null}
    </View>
  );
}

const statLabelStyle = {
  fontSize: 10.5,
  fontWeight: '700' as const,
  letterSpacing: 0.6,
  textTransform: 'uppercase' as const,
  color: TEXT.tertiary,
};

const statValueStyle = {
  fontFamily: FONTS.display,
  fontSize: 24,
  marginTop: 4,
};
