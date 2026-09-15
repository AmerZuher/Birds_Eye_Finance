import React, { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Landmark, ReceiptText, Wallet, Coins } from 'lucide-react-native';

import { PageTransition } from '@/components/PageTransition';
import { DonutChart } from '@/components/ui/DonutChart';
import type { DonutSlice } from '@/components/ui/DonutChart';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatTile } from '@/components/ui/StatTile';
import { EmptyState } from '@/components/ui/EmptyState';
import { MoneyAmount } from '@/components/ui/MoneyAmount';
import { GlowBlob } from '@/components/ui/GlowBlob';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useFinance } from '@/context/FinanceContext';
import { useChrome } from '@/context/ChromeContext';
import { FONTS, RADII, SEMANTIC } from '@/constants/theme';
import { categoricalRamp } from '@/utils/color';
import { getMonthlyEquivalent } from '@/lib/period';
import type { Period } from '@/lib/period';
import type { Expense } from '@/db/schema';
import { HIDDEN_SCROLLBARS } from '@/lib/scroll';
import { useDebts } from '@/context/DebtsContext';

// The 5 canonical expense categories, in a stable order so the same category
// always maps to the same slice color regardless of how many are present.
const CATEGORY_ORDER = ['essential', 'personal', 'subscriptions', 'entertainment', 'emergency'];

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
  const { headerHeight, navbarHeight } = useChrome();
  const { formatPercent, convertToBase } = useCurrency();
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

  // Share of income eaten by expenses (only meaningful when income > 0).
  const expenseRatio =
    totalMonthlyIncomeBase > 0 ? Math.min(1, totalExpenses / totalMonthlyIncomeBase) : 0;

  const topExpenses = useMemo(() => {
    return expenses
      .filter((e) => e.amount > 0)
      .map((e) => ({
        expense: e,
        monthly: convertToBase(monthlyAmount(e), e.currency ?? 'SAR'),
      }))
      .sort((a, b) => b.monthly - a.monthly)
      .slice(0, 5);
  }, [expenses, convertToBase]);

  const hasData = expenses.length > 0;

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

        {/* Full empty state when there's literally nothing to show */}
        {!hasData ? (
          <Animated.View entering={FadeInUp.duration(420).delay(140)}>
            <EmptyState icon={ReceiptText} caption={t('analytics.empty')} />
          </Animated.View>
        ) : null}
      </ScrollView>
    </PageTransition>
  );
}
