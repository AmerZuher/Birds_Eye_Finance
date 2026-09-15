import React, { useMemo, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import {
  ArrowRightLeft,
  CalendarClock,
  ChevronRight,
  Minus,
  Paperclip,
  Plus,
  StickyNote,
  TrendingDown,
  TrendingUp,
} from 'lucide-react-native';

import { AdjustmentSheet } from '@/components/AdjustmentSheet';
import type { AdjustmentDirection } from '@/components/AdjustmentSheet';
import { SavedAttachmentsField } from '@/components/DebtAttachments';
import { SectionLabel } from '@/components/FormField';
import { PersonPickerSheet } from '@/components/PersonPickerSheet';
import { Badge } from '@/components/ui/Badge';
import type { BadgeVariant } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { GlassModal } from '@/components/ui/GlassModal';
import { GradientButton } from '@/components/ui/GradientButton';
import { IconButton } from '@/components/ui/IconButton';
import { IconTile } from '@/components/ui/IconTile';
import { InlineBanner } from '@/components/ui/InlineBanner';
import type { BannerKind } from '@/components/ui/InlineBanner';
import { ListCard } from '@/components/ui/ListCard';
import { ListRow } from '@/components/ui/ListRow';
import { MoneyAmount } from '@/components/ui/MoneyAmount';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { useCurrency } from '@/context/CurrencyContext';
import { useDebtAdjustments, useDebtAttachments, useDebts } from '@/context/DebtsContext';
import type { DebtView } from '@/context/DebtsContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { RADII, SEMANTIC } from '@/constants/theme';
import type { DebtAdjustment } from '@/db/schema';
import { formatDebtId } from '@/lib/debtStatus';
import type { DebtStatus } from '@/lib/debtStatus';
import { HIDDEN_SCROLLBARS } from '@/lib/scroll';
import { withAlpha } from '@/utils/color';

// The ledger list is this sheet's scroller (GlassModal scrollable={false}), so
// it needs a bounded height — FlashList can't size itself to its content.
const LIST_HEIGHT_RATIO = 0.72;

/** The one mapping from derived status to its pill — shared by every debt row and this sheet. */
export function debtStatusBadge(
  status: DebtStatus,
  t: (key: string) => string,
): { label: string; variant: BadgeVariant } {
  if (status === 'settled') return { label: t('debts.status.paid'), variant: 'positive' };
  if (status === 'partial') return { label: t('debts.status.partial'), variant: 'warning' };
  return { label: t('debts.status.open'), variant: 'neutral' };
}

interface DebtDetailSheetProps {
  visible: boolean;
  debtId: number | null;
  onClose: () => void;
  onEdit: (debt: DebtView) => void;
}

/**
 * One debt at a glance (FEATURE_SPEC 1.10): balance, status, notes and
 * installment plan, proofs, and the adjustment ledger — with the actions to
 * record a payment, add to the debt, edit it, or move it to another person.
 * Reads the debt live by id, so it stays correct while entries are added and
 * when the debt settles and moves to History underneath it.
 */
export function DebtDetailSheet({ visible, debtId, onClose, onEdit }: DebtDetailSheetProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { formatOriginalMoney } = useCurrency();
  const { debtViewById, peopleById, moveDebt } = useDebts();
  const { height: windowHeight } = useWindowDimensions();

  const debt = debtId != null ? (debtViewById.get(debtId) ?? null) : null;
  const adjustments = useDebtAdjustments(debtId);
  const attachments = useDebtAttachments(debtId);

  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [adjustmentDirection, setAdjustmentDirection] = useState<AdjustmentDirection>('reduce');
  const [editingAdjustment, setEditingAdjustment] = useState<DebtAdjustment | null>(null);
  const [movePickerOpen, setMovePickerOpen] = useState(false);
  const [banner, setBanner] = useState<{ kind: BannerKind; message: string } | null>(null);

  const attachmentsByAdjustment = useMemo(() => {
    const ids = new Set<number>();
    for (const attachment of attachments) {
      if (attachment.adjustmentId != null) ids.add(attachment.adjustmentId);
    }
    return ids;
  }, [attachments]);

  const close = () => {
    setBanner(null);
    onClose();
  };

  const openNewAdjustment = (direction: AdjustmentDirection) => {
    setEditingAdjustment(null);
    setAdjustmentDirection(direction);
    setAdjustmentOpen(true);
  };

  const openEditAdjustment = (adjustment: DebtAdjustment) => {
    setEditingAdjustment(adjustment);
    setAdjustmentOpen(true);
  };

  const renderContent = (current: DebtView) => {
    const isPositive = current.type === 'positive';
    const accent = isPositive ? SEMANTIC.positive : SEMANTIC.negative;
    const currency = current.currency ?? 'SAR';
    const hasInstallment = current.type === 'negative' && current.monthlyPayment > 0;
    const badge = debtStatusBadge(current.status, t);
    const personName =
      (current.personId != null ? peopleById.get(current.personId)?.name : undefined) ??
      current.name;

    const balanceCells = [
      { key: 'debtDetail.original', amount: current.amount, color: theme.textPrimary },
      { key: 'debtDetail.adjustments', amount: current.adjustmentSum, color: theme.textSecondary },
      { key: 'debtDetail.outstanding', amount: current.outstanding, color: accent },
    ];

    const header = (
      <View style={{ gap: 14, paddingBottom: 10 }}>
        {banner ? (
          <InlineBanner
            kind={banner.kind}
            message={banner.message}
            onDismiss={() => setBanner(null)}
            autoDismissMs={4000}
          />
        ) : null}

        <View style={{ alignItems: 'center', gap: 8 }}>
          <IconTile size={52} backgroundColor={withAlpha(accent, 0.14)}>
            {isPositive ? (
              <TrendingUp size={22} color={accent} />
            ) : (
              <TrendingDown size={22} color={accent} />
            )}
          </IconTile>
          <MoneyAmount
            amount={current.outstanding}
            currencyCode={currency}
            color={accent}
            size={30}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Badge label={badge.label} variant={badge.variant} />
            <Text style={{ fontSize: 11.5, color: theme.textTertiary }}>
              {`${formatDebtId(current.id)} · ${t(`debts.type.${current.type}`)}`}
            </Text>
          </View>
          <Text style={{ fontSize: 11.5, color: theme.textTertiary }}>
            {`${personName} · ${current.date}`}
          </Text>
        </View>

        <View
          style={{
            flexDirection: 'row',
            paddingVertical: 12,
            borderRadius: RADII.field,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.surfaceAlt,
          }}
        >
          {balanceCells.map((cell) => (
            <View key={cell.key} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <Text
                style={{
                  fontSize: 9.5,
                  fontWeight: '700',
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  color: theme.textTertiary,
                }}
              >
                {t(cell.key)}
              </Text>
              <MoneyAmount
                amount={cell.amount}
                currencyCode={currency}
                color={cell.color}
                size={14}
              />
            </View>
          ))}
        </View>

        {current.status === 'partial' ? (
          <ProgressBar progress={current.progress} height={5} />
        ) : null}

        {current.notes ? (
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
              {current.notes}
            </Text>
          </View>
        ) : null}

        {hasInstallment ? (
          <View
            style={{
              gap: 12,
              padding: 14,
              borderRadius: RADII.field,
              backgroundColor: withAlpha(SEMANTIC.negative, 0.06),
              borderWidth: 1,
              borderColor: withAlpha(SEMANTIC.negative, 0.2),
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
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ fontSize: 11.5, color: theme.textSecondary }}>
                {t('debts.installmentDetailsSuffix')}
              </Text>
              <MoneyAmount
                amount={current.monthlyPayment}
                currencyCode={currency}
                color={theme.textPrimary}
                size={15}
              />
            </View>
            <View style={{ height: 1, backgroundColor: theme.borderSoft }} />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ fontSize: 11.5, color: theme.textSecondary }}>
                {current.startDate}
              </Text>
              <Text style={{ fontSize: 11, color: theme.textTertiary }}>→</Text>
              <Text style={{ fontSize: 11.5, color: theme.textSecondary }}>
                {current.endDate || t('debts.noEndDate')}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <SecondaryButton
              icon={Minus}
              color={SEMANTIC.positive}
              label={t('debtDetail.recordPayment')}
              disabled={current.status === 'settled'}
              onPress={() => openNewAdjustment('reduce')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <SecondaryButton
              icon={Plus}
              color={SEMANTIC.negative}
              label={t('debtDetail.addToDebt')}
              onPress={() => openNewAdjustment('increase')}
            />
          </View>
        </View>

        <SavedAttachmentsField
          debtId={current.id}
          onError={(message) => setBanner({ kind: 'error', message })}
        />

        <SectionLabel>{t('debtDetail.adjustments')}</SectionLabel>
      </View>
    );

    return (
      <View style={{ height: Math.round(windowHeight * LIST_HEIGHT_RATIO) }}>
        <FlashList
          data={adjustments}
          keyExtractor={(item) => String(item.id)}
          {...HIDDEN_SCROLLBARS}
          ListHeaderComponent={header}
          ListEmptyComponent={<EmptyState caption={t('debtDetail.ledgerEmpty')} />}
          ListFooterComponent={
            <View style={{ gap: 12, paddingTop: 16 }}>
              <GradientButton label={t('debts.editTransaction')} onPress={() => onEdit(current)} />
              <SecondaryButton
                variant="link"
                icon={ArrowRightLeft}
                label={t('debtDetail.moveToPerson')}
                onPress={() => setMovePickerOpen(true)}
              />
            </View>
          }
          renderItem={({ item, index }) => {
            const reduces = item.amount < 0;
            const tint = reduces ? SEMANTIC.positive : SEMANTIC.negative;
            const Icon = reduces ? Minus : Plus;
            return (
              <ListCard isLast={index === adjustments.length - 1}>
                <ListRow
                  showBottomBorder={false}
                  onPress={() => openEditAdjustment(item)}
                  leading={
                    <IconTile size={36} backgroundColor={withAlpha(tint, 0.14)}>
                      <Icon size={15} color={tint} />
                    </IconTile>
                  }
                  title={`${reduces ? '−' : '+'}${formatOriginalMoney(Math.abs(item.amount), currency)}`}
                  subtitle={item.note ? `${item.date} · ${item.note}` : item.date}
                  trailing={
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {attachmentsByAdjustment.has(item.id) ? (
                        <Paperclip size={13} color={theme.textTertiary} />
                      ) : null}
                      <IconButton
                        icon={ChevronRight}
                        accessibilityLabel={t('debtDetail.editAdjustment')}
                        onPress={() => openEditAdjustment(item)}
                        directional
                        size={22}
                        iconSize={11}
                      />
                    </View>
                  }
                />
              </ListCard>
            );
          }}
        />
      </View>
    );
  };

  return (
    <>
      <GlassModal
        visible={visible}
        onClose={close}
        title={debt ? formatDebtId(debt.id) : undefined}
        scrollable={false}
      >
        {debt ? renderContent(debt) : null}
      </GlassModal>

      <AdjustmentSheet
        visible={adjustmentOpen}
        onClose={() => setAdjustmentOpen(false)}
        debt={debt}
        editing={editingAdjustment}
        initialDirection={adjustmentDirection}
        onSettled={(settled) =>
          setBanner({
            kind: 'success',
            message: t('debts.settledBanner', { id: formatDebtId(settled.id) }),
          })
        }
      />

      <PersonPickerSheet
        visible={movePickerOpen}
        onClose={() => setMovePickerOpen(false)}
        title={t('debtDetail.moveToPerson')}
        excludeIds={debt?.personId != null ? [debt.personId] : []}
        onSelect={(person) => {
          setMovePickerOpen(false);
          if (!debt) return;
          moveDebt(debt.id, person.id);
          setBanner({
            kind: 'success',
            message: t('debtDetail.movedBanner', { name: person.name }),
          });
        }}
      />
    </>
  );
}
