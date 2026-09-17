import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { SectionLabel } from '@/components/FormField';
import { PageTransition } from '@/components/PageTransition';
import { Avatar } from '@/components/ui/Avatar';
import { BalanceRevealCard } from '@/components/ui/BalanceRevealCard';
import { ReconciliationNudgeCard } from '@/components/ui/ReconciliationNudgeCard';
import { ListCard } from '@/components/ui/ListCard';
import { ListRow } from '@/components/ui/ListRow';
import { MoneyAmount } from '@/components/ui/MoneyAmount';
import { RingGauge } from '@/components/ui/RingGauge';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { SettingsCard } from '@/components/ui/SettingsCard';
import { useChrome } from '@/context/ChromeContext';
import { useBalance } from '@/context/BalanceContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useDebts } from '@/context/DebtsContext';
import type { DebtGroup } from '@/context/DebtsContext';
import { useFinance } from '@/context/FinanceContext';
import type { FinancialHealthTier } from '@/context/FinanceContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { FONTS, SEMANTIC } from '@/constants/theme';
import type { Person } from '@/db/schema';
import { avatarDisplayUri } from '@/lib/avatars';
import { addDays, daysBetween, todayStr } from '@/lib/dates';
import { formatDebtId, isMoneyZero } from '@/lib/debtStatus';
import { hasInstallmentPlan, installmentEvents } from '@/lib/installments';
import { getString, storage, StorageKeys } from '@/lib/mmkv';
import { isOnTrack } from '@/lib/reconciliation';
import type { InstallmentEvent } from '@/lib/installments';
import { HIDDEN_SCROLLBARS } from '@/lib/scroll';
import { healthTierColor } from '@/utils/color';

/** Coming up looks this many days ahead, today included (FEATURE_SPEC 7.5). */
const COMING_UP_DAYS = 30;
const COMING_UP_MAX_ROWS = 5;
/** A dismissed balance nudge comes back after this long, if the log is still stale (FEATURE_SPEC 7.4). */
const NUDGE_SNOOZE_DAYS = 7;

/** People listed under the Debts totals (FEATURE_SPEC 7.7). */
const TOP_PEOPLE = 3;

function greetingKey(hour: number): string {
  if (hour < 12) return 'dashboard.greeting.morning';
  if (hour < 18) return 'dashboard.greeting.afternoon';
  return 'dashboard.greeting.evening';
}

function signColor(value: number, neutral: string): string {
  if (isMoneyZero(value)) return neutral;
  return value > 0 ? SEMANTIC.positive : SEMANTIC.negative;
}

/** Where the user stands and what's next, from logged records only (FEATURE_SPEC Part 7, CLAUDE.md rule 15). */
export default function Dashboard() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { headerHeight, navbarHeight, requestDebtOpen, openLogBalance } = useChrome();
  const { convertToBase, formatMoney } = useCurrency();
  const { profile } = useUser();
  const { totalMonthlyIncomeBase, totalExpenses, netSavings, savingsRate, financialHealth } =
    useFinance();
  const { debtViews, payments, groupedDebts, peopleById, debtsCalculations } = useDebts();
  const { currentBalance, latest, daysSince, isStale, latestVariance } = useBalance();

  const hour = new Date().getHours();
  const today = todayStr();

  // Where the hero's figure comes from, and how old it is (7.3).
  const balanceCaption = !latest
    ? t('dashboard.fromAccounts')
    : daysSince === 0
      ? t('dashboard.loggedToday')
      : daysSince === 1
        ? t('dashboard.loggedYesterday')
        : t('dashboard.loggedDaysAgo', { n: String(daysSince) });

  // Null until a second log exists — one log has nothing to be compared against.
  const variance =
    latestVariance === null
      ? null
      : {
          amount: isOnTrack(latestVariance) ? null : latestVariance,
          label: isOnTrack(latestVariance) ? t('dashboard.onTrack') : t('dashboard.vsExpected'),
          onPress: () => router.navigate('/analytics'),
        };

  // Dismissing the nudge snoozes it rather than silencing it for good: the
  // date is remembered, and it returns a week later if the log is still stale.
  const [nudgeDismissedOn, setNudgeDismissedOn] = useState<string | null>(
    () => getString(StorageKeys.balanceNudgeDismissed) ?? null,
  );
  const snoozed =
    nudgeDismissedOn !== null && daysBetween(nudgeDismissedOn, today) < NUDGE_SNOOZE_DAYS;
  const showNudge = isStale && !snoozed;

  const dismissNudge = () => {
    storage.set(StorageKeys.balanceNudgeDismissed, today);
    setNudgeDismissedOn(today);
  };

  const hasPlans = useMemo(() => debtViews.some(hasInstallmentPlan), [debtViews]);
  const comingUp = useMemo(
    () => installmentEvents(debtViews, payments, today, addDays(today, COMING_UP_DAYS)),
    [debtViews, payments, today],
  );
  const topPeople = useMemo(() => groupedDebts.slice(0, TOP_PEOPLE), [groupedDebts]);

  const openOnDebts = (personId: number | null, debtId?: number) => {
    requestDebtOpen({ personId, debtId });
    router.navigate('/debts');
  };

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

        {/* Current balance hero (FEATURE_SPEC 7.3): the logged balance aged
            forward once there is one, the typed accounts until then. */}
        <Animated.View entering={FadeInUp.duration(420).delay(60)}>
          <BalanceRevealCard
            label={t('dashboard.currentBalance')}
            amount={currentBalance}
            caption={balanceCaption}
            captionDetail={
              latest && daysSince !== null && daysSince > 0
                ? formatMoney(convertToBase(latest.amount, latest.currency))
                : undefined
            }
            variance={variance}
            actionLabel={latest ? undefined : t('dashboard.logBalance')}
            onAction={latest ? undefined : openLogBalance}
          />
        </Animated.View>

        {/* Balance check (7.4) — only once a log has gone stale. */}
        {showNudge && daysSince !== null ? (
          <Animated.View entering={FadeInUp.duration(420).delay(90)}>
            <ReconciliationNudgeCard
              message={t('dashboard.nudgeMessage', { n: String(daysSince) })}
              actionLabel={t('dashboard.logBalance')}
              onAction={openLogBalance}
              onDismiss={dismissNudge}
              dismissLabel={t('dashboard.nudgeDismiss')}
            />
          </Animated.View>
        ) : null}

        {hasPlans ? (
          <Animated.View entering={FadeInUp.duration(420).delay(110)}>
            <SectionHeader label={t('dashboard.comingUp')} />
            <ComingUp
              events={comingUp}
              peopleById={peopleById}
              today={today}
              onOpen={(event) => openOnDebts(event.personId, event.debtId)}
            />
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInUp.duration(420).delay(160)}>
          <SectionHeader label={t('dashboard.thisMonth')} />
          <ThisMonthCard
            income={totalMonthlyIncomeBase}
            installments={debtsCalculations.totalNegativeMonthly}
            expenses={totalExpenses}
            netSavings={netSavings}
            savingsRate={savingsRate}
            tier={financialHealth}
            onOpenAnalytics={() => router.navigate('/analytics')}
            onAddIncome={() => router.navigate('/settings/edit-profile')}
          />
        </Animated.View>

        {topPeople.length > 0 ? (
          <Animated.View entering={FadeInUp.duration(420).delay(210)}>
            <SectionHeader
              label={t('dashboard.debts')}
              action={{ label: t('dashboard.seeAll'), onPress: () => openOnDebts(null) }}
            />
            <DebtsSummary
              owedToMe={debtsCalculations.totalPositiveAmount}
              iOwe={debtsCalculations.totalNegativeAmount}
              people={topPeople}
              onOpenPerson={(personId) => openOnDebts(personId)}
            />
          </Animated.View>
        ) : null}
      </ScrollView>
    </PageTransition>
  );
}

function SectionHeader({
  label,
  action,
}: {
  label: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 26,
        marginBottom: 8,
      }}
    >
      <SectionLabel>{label}</SectionLabel>
      {action ? (
        <SecondaryButton variant="link" label={action.label} onPress={action.onPress} />
      ) : null}
    </View>
  );
}

/** Installments due and plans ending in the next 30 days (FEATURE_SPEC 7.5). */
function ComingUp({
  events,
  peopleById,
  today,
  onOpen,
}: {
  events: InstallmentEvent[];
  peopleById: Map<number, Person>;
  today: string;
  onOpen: (event: InstallmentEvent) => void;
}) {
  const { t } = useLanguage();
  const { theme } = useTheme();

  if (events.length === 0) {
    return (
      <Text style={{ fontSize: 12, color: theme.textTertiary }}>{t('dashboard.nothingDue')}</Text>
    );
  }

  const shown = events.slice(0, COMING_UP_MAX_ROWS);
  const hiddenCount = events.length - shown.length;

  return (
    <View>
      {shown.map((event, index) => {
        const person = peopleById.get(event.personId);
        const days = daysBetween(today, event.date);
        const when =
          days <= 0
            ? t('dashboard.today')
            : days === 1
              ? t('dashboard.tomorrow')
              : t('dashboard.inDays', { n: days });
        const what = t(
          event.kind === 'installment' ? 'dashboard.installmentRow' : 'dashboard.planEndsRow',
          { id: formatDebtId(event.debtId) },
        );
        return (
          <ListCard
            key={`${event.kind}-${event.debtId}-${event.date}`}
            isLast={index === shown.length - 1}
          >
            <ListRow
              onPress={() => onOpen(event)}
              showBottomBorder={false}
              leading={
                <Avatar name={person?.name} photoUri={avatarDisplayUri(person?.avatar)} size={36} />
              }
              title={person?.name ?? ''}
              subtitle={`${what} · ${when}`}
              trailing={
                <MoneyAmount
                  amount={event.amount}
                  currencyCode={event.currency}
                  color={SEMANTIC.negative}
                  size={15}
                />
              }
            />
          </ListCard>
        );
      })}
      {hiddenCount > 0 ? (
        <Text
          style={{ fontSize: 11, color: theme.textTertiary, textAlign: 'center', marginTop: 8 }}
        >
          {t('dashboard.moreCount', { n: hiddenCount })}
        </Text>
      ) : null}
    </View>
  );
}

interface ThisMonthCardProps {
  income: number;
  installments: number;
  expenses: number;
  netSavings: number;
  savingsRate: number;
  tier: FinancialHealthTier;
  onOpenAnalytics: () => void;
  onAddIncome: () => void;
}

/** Savings-rate ring beside income − installments − expenses = net savings (FEATURE_SPEC 7.6). */
function ThisMonthCard({
  income,
  installments,
  expenses,
  netSavings,
  savingsRate,
  tier,
  onOpenAnalytics,
  onAddIncome,
}: ThisMonthCardProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { formatPercent } = useCurrency();
  const hasIncome = income > 0;
  const tierColor = healthTierColor(tier, theme);

  return (
    <Pressable
      onPress={onOpenAnalytics}
      accessibilityRole="button"
      accessibilityHint={t('dashboard.openAnalytics')}
    >
      <SettingsCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <RingGauge
              progress={hasIncome ? savingsRate / 100 : 0}
              size={108}
              strokeWidth={9}
              colors={[tierColor, tierColor]}
            >
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: theme.textPrimary }}>
                  {hasIncome ? `${formatPercent(savingsRate)}%` : '—'}
                </Text>
                <Text style={{ fontSize: 9, color: theme.textTertiary }}>
                  {t('dashboard.savingsRate')}
                </Text>
              </View>
            </RingGauge>
            {hasIncome ? (
              <Text style={{ fontSize: 11, fontWeight: '700', color: tierColor }}>
                {t(`editProfile.health.${tier}`)}
              </Text>
            ) : null}
          </View>

          <View style={{ flex: 1, gap: 8 }}>
            <BreakdownLine
              label={t('dashboard.income')}
              amount={income}
              color={theme.textPrimary}
            />
            <BreakdownLine
              label={t('dashboard.installments')}
              amount={installments > 0 ? -installments : 0}
              color={theme.textSecondary}
            />
            <BreakdownLine
              label={t('dashboard.expenses')}
              amount={expenses > 0 ? -expenses : 0}
              color={theme.textSecondary}
            />
            <View style={{ height: 1, backgroundColor: theme.border }} />
            <BreakdownLine
              label={t('dashboard.netSavings')}
              amount={netSavings}
              color={signColor(netSavings, theme.textSecondary)}
              strong
            />
            {!hasIncome ? (
              <SecondaryButton
                variant="link"
                label={t('dashboard.addIncome')}
                onPress={onAddIncome}
              />
            ) : null}
          </View>
        </View>
      </SettingsCard>
    </Pressable>
  );
}

function BreakdownLine({
  label,
  amount,
  color,
  strong = false,
}: {
  label: string;
  amount: number;
  color: string;
  strong?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          flexShrink: 1,
          fontSize: strong ? 12.5 : 11.5,
          fontWeight: strong ? '700' : '500',
          color: strong ? theme.textPrimary : theme.textSecondary,
        }}
      >
        {label}
      </Text>
      <MoneyAmount amount={amount} color={color} size={strong ? 17 : 14} />
    </View>
  );
}

/** Owed to me / I owe / net, then the people with the largest balances (FEATURE_SPEC 7.7). */
function DebtsSummary({
  owedToMe,
  iOwe,
  people,
  onOpenPerson,
}: {
  owedToMe: number;
  iOwe: number;
  people: DebtGroup[];
  onOpenPerson: (personId: number) => void;
}) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const net = owedToMe - iOwe;

  return (
    <View style={{ gap: 10 }}>
      <SettingsCard>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <DebtTotal label={t('debts.type.positive')} amount={owedToMe} color={SEMANTIC.positive} />
          <DebtTotal label={t('debts.type.negative')} amount={iOwe} color={SEMANTIC.negative} />
          <DebtTotal
            label={t('dashboard.net')}
            amount={net}
            color={signColor(net, theme.textSecondary)}
          />
        </View>
      </SettingsCard>
      <View>
        {people.map((group, index) => (
          <ListCard key={group.personId} isLast={index === people.length - 1}>
            <ListRow
              onPress={() => onOpenPerson(group.personId)}
              showBottomBorder={false}
              leading={
                <Avatar name={group.name} photoUri={group.avatar} ring={group.type} size={36} />
              }
              title={group.name}
              subtitle={t(
                group.type === 'settled' ? 'debts.status.settled' : `debts.type.${group.type}`,
              )}
              trailing={
                <MoneyAmount
                  amount={group.totalNet}
                  color={signColor(group.totalNet, theme.textSecondary)}
                  size={15}
                />
              }
            />
          </ListCard>
        ))}
      </View>
    </View>
  );
}

function DebtTotal({ label, amount, color }: { label: string; amount: number; color: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <Text
        numberOfLines={1}
        style={{
          fontSize: 9.5,
          fontWeight: '700',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: theme.textTertiary,
        }}
      >
        {label}
      </Text>
      <View style={{ width: '100%' }}>
        <MoneyAmount amount={amount} color={color} size={16} align="center" shrinkToFit />
      </View>
    </View>
  );
}
