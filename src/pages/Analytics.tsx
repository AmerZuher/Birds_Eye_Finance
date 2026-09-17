import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Landmark, ReceiptText, Scale, Wallet, Coins } from 'lucide-react-native';

import { PageTransition } from '@/components/PageTransition';
import { DonutChart } from '@/components/ui/DonutChart';
import type { DonutSlice } from '@/components/ui/DonutChart';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatTile } from '@/components/ui/StatTile';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { SettingsCard } from '@/components/ui/SettingsCard';
import { VarianceHistoryChart } from '@/components/ui/VarianceHistoryChart';
import type { VarianceRow } from '@/components/ui/VarianceHistoryChart';
import { MoneyAmount } from '@/components/ui/MoneyAmount';
import { GlowBlob } from '@/components/ui/GlowBlob';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useFinance } from '@/context/FinanceContext';
import { useChrome } from '@/context/ChromeContext';
import { useBalance } from '@/context/BalanceContext';
import { FONTS, RADII, SEMANTIC } from '@/constants/theme';
import { categoricalRamp } from '@/utils/color';
import { getMonthlyEquivalent } from '@/lib/period';
import type { Period } from '@/lib/period';
import type { Expense } from '@/db/schema';
import { HIDDEN_SCROLLBARS } from '@/lib/scroll';
import { isOnTrack } from '@/lib/reconciliation';
import { useDebts } from '@/context/DebtsContext';

// The 5 canonical expense categories, in a stable order so the same category
// always maps to the same slice color regardless of how many are present.
const CATEGORY_ORDER = ['essential', 'personal', 'subscriptions', 'entertainment', 'emergency'];

/** Balance logs shown in the variance card before it starts counting the rest (FEATURE_SPEC 8.3). */
const VARIANCE_ROWS = 6;

function monthlyAmount(expense: Expense): number {
  return getMonthlyEquivalent(
    expense.amount,
    (expense.period as Period) ?? 'monthly',
    expense.customPeriodDays ?? undefined,
  );
}

export default function Analytics() {
  const { theme } = useTheme();
  const { t, isRTL } = useLanguage();
  const { headerHeight, navbarHeight, openLogBalance } = useChrome();
  const { formatPercent, convertToBase, formatMoney } = useCurrency();
  const { history, deleteSnapshot } = useBalance();
  const { expenses, totalExpenses, totalMonthlyIncomeBase, netSavings } = useFinance();
  const { debtsCalculations } = useDebts();

  // Group configured expenses by category, summing their monthly equivalent
  // in base currency. Unconfigured (amount 0) are excluded from the chart but
  // still counted in the "unconfigured" stat so the screen never fabricates
  // spending that hasn't been priced yet.
  const { slices, unconfiguredCount } = useMemo(() => {
    const sums = new Map<string, number>();
    let unconfigured = 0;
    for (const expense of expenses) {
      if (expense.amount === 0) {
        unconfigured += 1;
        continue;
      }
      const monthly = convertToBase(monthlyAmount(expense), expense.currency ?? 'SAR');
      sums.set(expense.category, (sums.get(expense.category) ?? 0) + monthly);
    }

    // A categorical ramp spun off the active theme's accent hue keeps the
    // chart on-palette — each category gets a fixed slot in the ramp so the
    // same category always wears the same color, but the whole ramp shifts to
    // harmonize with whichever theme is selected. No hardcoded hex.
    const ramp = categoricalRamp(theme.accent1, CATEGORY_ORDER.length);

    const ordered: DonutSlice[] = CATEGORY_ORDER.filter((c) => (sums.get(c) ?? 0) > 0).map(
      (category) => ({
        value: sums.get(category) ?? 0,
        color: ramp[CATEGORY_ORDER.indexOf(category) % ramp.length],
        label: t(`expenses.category.${category}`),
      }),
    );
    return { slices: ordered, unconfiguredCount: unconfigured };
  }, [expenses, convertToBase, t, theme.accent1]);

  const chartTotal = slices.reduce((sum, s) => sum + s.value, 0);

  // Expected vs actual (FEATURE_SPEC 8.3). `history` is oldest first and its
  // first entry has nothing to compare against, so it never becomes a row.
  const varianceRows = useMemo<VarianceRow[]>(
    () =>
      history
        .filter((entry) => entry.variance !== null && entry.expected !== null)
        .reverse()
        .slice(0, VARIANCE_ROWS)
        .map((entry) => ({
          key: entry.snapshot.id,
          label: entry.snapshot.date,
          logged: entry.logged,
          expected: entry.expected as number,
          variance: entry.variance as number,
          expectedLabel: t('analytics.variance.expected', {
            amount: formatMoney(entry.expected as number),
          }),
        })),
    [history, t, formatMoney],
  );
  const comparedCount = history.filter((entry) => entry.variance !== null).length;

  // Today's log is corrected by logging again (FEATURE_SPEC 9.2); an older one
  // is fixed by removing it here and logging the right figure.
  const [pendingDelete, setPendingDelete] = useState<VarianceRow | null>(null);

  // One factual line about the latest interval — what happened, and nothing
  // about why: the app can't know which category caused a gap (8.3).
  const latest = history.length ? history[history.length - 1] : null;
  const varianceInsight =
    !latest || latest.variance === null || latest.days === null
      ? null
      : isOnTrack(latest.variance)
        ? t('analytics.variance.onTrack')
        : t(latest.variance > 0 ? 'analytics.variance.above' : 'analytics.variance.below', {
            amount: formatMoney(Math.abs(latest.variance)),
            n: String(latest.days),
          });

  // Share of income eaten by expenses (only meaningful when income > 0).
  const expenseRatio =
    totalMonthlyIncomeBase > 0 ? Math.min(1, totalExpenses / totalMonthlyIncomeBase) : 0;

  return (
    <PageTransition>
      <ScrollView
        style={{ backgroundColor: theme.ground }}
        contentContainerStyle={{
          padding: 16,
          paddingTop: headerHeight + 20,
          paddingBottom: navbarHeight + 45,
          gap: 16,
        }}
        {...HIDDEN_SCROLLBARS}
      >
        <Animated.View entering={FadeInDown.duration(420)} style={{ gap: 2 }}>
          <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: theme.textPrimary }}>
            {t('analytics.title')}
          </Text>
          <Text style={{ fontSize: 12, color: theme.textTertiary }}>{t('analytics.subtitle')}</Text>
          <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 14 }} />
        </Animated.View>

        {/* Spending breakdown */}
        <Animated.View entering={FadeInUp.duration(420).delay(60)}>
          <View
            style={{
              borderRadius: RADII.card,
              backgroundColor: theme.surface,
              shadowColor: `rgb(${theme.glow.a})`,
              shadowOpacity: 0.22,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 8 },
              elevation: 6,
            }}
          >
            <LinearGradient
              colors={[theme.surfaceAlt, theme.surface]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: RADII.card,
                borderWidth: 1,
                borderColor: `rgba(${theme.glow.a},0.22)`,
                padding: 20,
                gap: 18,
              }}
            >
              <GlowBlob color={`rgb(${theme.glow.a})`} corner="topStart" />
              <GlowBlob color={`rgb(${theme.glow.b})`} corner="bottomEnd" />

              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '700',
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  color: theme.textTertiary,
                }}
              >
                {t('analytics.spendingByCategory')}
              </Text>

              {slices.length === 0 ? (
                <EmptyState icon={ReceiptText} caption={t('analytics.empty')} />
              ) : (
                <>
                  <View style={{ alignItems: 'center', gap: 10 }}>
                    <DonutChart slices={slices} size={225} strokeWidth={18} gap={4}>
                      <View style={{ alignItems: 'center', gap: 3 }}>
                        <MoneyAmount amount={chartTotal} size={40} align="center" shrinkToFit />
                        <Text
                          style={{ fontSize: 10.5, color: theme.textTertiary, letterSpacing: 0.5 }}
                        >
                          {t('analytics.monthlySpend')}
                        </Text>
                      </View>
                    </DonutChart>
                  </View>

                  {/* Legend */}
                  <View style={{ gap: 10 }}>
                    {slices.map((slice) => {
                      const pct = chartTotal > 0 ? (slice.value / chartTotal) * 100 : 0;
                      return (
                        <View key={slice.label} style={{ gap: 5 }}>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                              <View
                                style={{
                                  width: 9,
                                  height: 9,
                                  borderRadius: 4.5,
                                  backgroundColor: slice.color,
                                }}
                              />
                              <Text style={{ fontSize: 11.5, color: theme.textSecondary }}>
                                {slice.label}
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <MoneyAmount amount={slice.value} size={16} align="right" />
                              <Text
                                style={{
                                  fontSize: 10,
                                  color: theme.textTertiary,
                                  width: 40,
                                  textAlign: isRTL ? 'left' : 'right',
                                }}
                              >
                                {formatPercent(pct)}%
                              </Text>
                            </View>
                          </View>
                          <ProgressBar
                            progress={pct / 100}
                            height={5}
                            colors={[slice.color, slice.color]}
                          />
                        </View>
                      );
                    })}
                  </View>
                </>
              )}
            </LinearGradient>
          </View>
        </Animated.View>

        {/* Expected vs actual (8.3) */}
        <Animated.View entering={FadeInUp.duration(420).delay(90)}>
          <SettingsCard title={t('analytics.variance.title')}>
            {varianceRows.length ? (
              <View style={{ gap: 14 }}>
                {varianceInsight ? (
                  <Text style={{ fontSize: 12, color: theme.textSecondary }}>
                    {varianceInsight}
                  </Text>
                ) : null}
                <VarianceHistoryChart
                  onSelectRow={setPendingDelete}
                  rows={varianceRows}
                  moreCount={comparedCount - varianceRows.length}
                  moreLabel={t('dashboard.moreCount', {
                    n: String(comparedCount - varianceRows.length),
                  })}
                />
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                <EmptyState icon={Scale} caption={t('analytics.variance.empty')} />
                <SecondaryButton
                  variant="link"
                  label={t('dashboard.logBalance')}
                  onPress={openLogBalance}
                />
              </View>
            )}
          </SettingsCard>
        </Animated.View>

        {/* Stat grid */}
        <Animated.View
          entering={FadeInUp.duration(420).delay(120)}
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}
        >
          <View style={{ width: '48%', flexGrow: 1 }}>
            <StatTile
              icon={Wallet}
              label={t('analytics.totalMonthly')}
              amount={totalExpenses}
              accent={theme.accent2}
            />
          </View>
          <View style={{ width: '48%', flexGrow: 1 }}>
            <StatTile
              icon={Landmark}
              label={t('analytics.installments')}
              amount={debtsCalculations.totalNegativeMonthly}
              accent={theme.accent2}
            />
          </View>
          <View style={{ width: '48%', flexGrow: 1 }}>
            <StatTile
              icon={Coins}
              label={t('analytics.netSavings')}
              amount={netSavings}
              accent={netSavings >= 0 ? SEMANTIC.positive : SEMANTIC.negative}
            />
          </View>
          <View style={{ width: '48%', flexGrow: 1 }}>
            <StatTile
              icon={ReceiptText}
              label={t('analytics.unconfigured')}
              value={String(unconfiguredCount)}
              accent={theme.accent2}
            />
          </View>
        </Animated.View>

        {/* Expense-to-income bar */}
        {totalMonthlyIncomeBase > 0 ? (
          <Animated.View
            entering={FadeInUp.duration(420).delay(180)}
            style={{
              borderRadius: RADII.card,
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.border,
              padding: 16,
              gap: 10,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '700',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: theme.textTertiary,
                }}
              >
                {t('analytics.expenseToIncome')}
              </Text>
              <Text style={{ fontFamily: FONTS.display, fontSize: 13, color: theme.textPrimary }}>
                {formatPercent(expenseRatio * 100)}%
              </Text>
            </View>
            <ProgressBar
              progress={expenseRatio}
              height={10}
              colors={[`rgb(${theme.glow.a})`, `rgb(${theme.glow.b})`]}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
              <MoneyAmount amount={totalExpenses} color={theme.textTertiary} size={12} />
              <Text style={{ fontSize: 10.5, color: theme.textTertiary }}>
                {t('analytics.expenseToIncomeMid')}
              </Text>
              <MoneyAmount amount={totalMonthlyIncomeBase} color={theme.textTertiary} size={12} />
              <Text style={{ fontSize: 10.5, color: theme.textTertiary }}>
                {t('analytics.expenseToIncomeSuffix')}
              </Text>
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>

      <ConfirmModal
        visible={pendingDelete !== null}
        title={t('analytics.variance.deleteTitle')}
        subtitle={
          pendingDelete
            ? t('analytics.variance.deleteSubtitle', { date: pendingDelete.label })
            : undefined
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void deleteSnapshot(Number(pendingDelete.key));
          setPendingDelete(null);
        }}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
      />
    </PageTransition>
  );
}
