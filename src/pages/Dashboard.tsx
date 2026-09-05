import React, { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ArrowDownToLine, ArrowUpFromLine, Landmark, TrendingUp } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { PageTransition } from '@/components/PageTransition';
import { StatTile } from '@/components/ui/StatTile';
import { BalanceRevealCard } from '@/components/ui/BalanceRevealCard';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useUser } from '@/context/UserContext';
import { useFinance } from '@/context/FinanceContext';
import { useChrome } from '@/context/ChromeContext';
import { FONTS, SEMANTIC } from '@/constants/theme';

function greetingKey(hour: number): string {
  if (hour < 12) return 'dashboard.greeting.morning';
  if (hour < 18) return 'dashboard.greeting.afternoon';
  return 'dashboard.greeting.evening';
}

export default function Dashboard() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { headerHeight, navbarHeight } = useChrome();
  const { convertToBase } = useCurrency();
  const { profile } = useUser();
  const { totalMonthlyIncomeBase, totalExpenses, debtsCalculations, netSavings } = useFinance();

  const hour = new Date().getHours();

  const totalBalancesBase = useMemo(
    () =>
      (profile.startBalances ?? []).reduce(
        (sum, b) => sum + convertToBase(b.amount, b.currency),
        0,
      ),
    [profile.startBalances, convertToBase],
  );

  const statTiles: { icon: LucideIcon; label: string; amount: number; color: string }[] = [
    {
      icon: ArrowDownToLine,
      label: t('dashboard.income'),
      amount: totalMonthlyIncomeBase,
      color: SEMANTIC.positive,
    },
    {
      icon: ArrowUpFromLine,
      label: t('dashboard.expenses'),
      amount: totalExpenses,
      color: SEMANTIC.negative,
    },
    {
      icon: Landmark,
      label: t('dashboard.installments'),
      amount: debtsCalculations.totalNegativeMonthly,
      color: theme.accent2,
    },
    {
      icon: TrendingUp,
      label: t('dashboard.netSavings'),
      amount: netSavings,
      color: netSavings >= 0 ? SEMANTIC.positive : SEMANTIC.negative,
    },
  ];

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
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <Animated.View entering={FadeInDown.duration(420)} style={{ gap: 2 }}>
          <Text style={{ fontSize: 12, color: theme.textTertiary, fontWeight: '600' }}>
            {t(greetingKey(hour))}
          </Text>
          <Text style={{ fontFamily: FONTS.display, fontSize: 26, color: theme.textPrimary }}>
            {profile.name || t('app.shortName')}
          </Text>
          <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 14 }} />

        </Animated.View>

        {/* Current balance hero */}
        <Animated.View entering={FadeInUp.duration(420).delay(60)}>
          <BalanceRevealCard label={t('dashboard.currentBalance')} amount={totalBalancesBase} />
        </Animated.View>


        {/* Stat grid */}
        <Animated.View
          entering={FadeInUp.duration(420).delay(110)}
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}
        >
          {statTiles.map((s) => (
            <View key={s.label} style={{ width: '48%', flexGrow: 1 }}>
              <StatTile icon={s.icon} label={s.label} amount={s.amount} accent={s.color} />
            </View>
          ))}
        </Animated.View>



      </ScrollView>
    </PageTransition>
  );
}
