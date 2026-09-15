import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useForm } from 'react-hook-form';
import type { SubmitErrorHandler, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Haptics from 'expo-haptics';
import { Minus, Plus, Trash2 } from 'lucide-react-native';

import { SavedAttachmentsField, StagedAttachmentsField } from '@/components/DebtAttachments';
import { FormField, TextField } from '@/components/FormField';
import { AmountInput } from '@/components/ui/AmountInput';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { GlassModal } from '@/components/ui/GlassModal';
import { GradientButton } from '@/components/ui/GradientButton';
import { InlineBanner } from '@/components/ui/InlineBanner';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useCurrency } from '@/context/CurrencyContext';
import { useDebts } from '@/context/DebtsContext';
import type { DebtView } from '@/context/DebtsContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { SEMANTIC } from '@/constants/theme';
import type { DebtAdjustment } from '@/db/schema';
import { discardStagedFile } from '@/lib/attachments';
import type { StagedFile } from '@/lib/attachments';
import { isValidDateStr, todayStr } from '@/lib/dates';
import { MONEY_EPSILON, formatDebtId } from '@/lib/debtStatus';

export type AdjustmentDirection = 'reduce' | 'increase';

const formSchema = z.object({
  direction: z.enum(['reduce', 'increase']),
  amount: z.string().refine(
    (value) => {
      const parsed = parseFloat(value);
      return value.trim().length > 0 && !Number.isNaN(parsed) && parsed > 0;
    },
    { message: 'amount' },
  ),
  date: z.string().refine(isValidDateStr, { message: 'date' }),
  note: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

interface AdjustmentSheetProps {
  visible: boolean;
  onClose: () => void;
  debt: DebtView | null;
  /** An existing ledger entry to edit, or null to record a new one. */
  editing: DebtAdjustment | null;
  initialDirection: AdjustmentDirection;
  /** Fired when this save took an open debt to zero. */
  onSettled: (debt: DebtView) => void;
}

/**
 * Record or edit one ledger entry against a debt (FEATURE_SPEC 1.10). The sign
 * rule never changes — "reduce" always lowers what's outstanding — only the
 * label follows the debt's type ("I paid" vs "They paid me"). Always in the
 * debt's own currency; overpaying is rejected.
 */
export function AdjustmentSheet({
  visible,
  onClose,
  debt,
  editing,
  initialDirection,
  onSettled,
}: AdjustmentSheetProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { formatOriginalMoney } = useCurrency();
  const { addAdjustment, updateAdjustment, deleteAdjustment, addAttachments } = useDebts();

  const { watch, setValue, reset, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { direction: 'reduce', amount: '', date: '', note: '' },
  });
  const values = watch();

  const [error, setError] = useState('');
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!visible) return;
    reset(
      editing
        ? {
            direction: editing.amount < 0 ? 'reduce' : 'increase',
            amount: String(Math.abs(editing.amount)),
            date: editing.date,
            note: editing.note ?? '',
          }
        : { direction: initialDirection, amount: '', date: todayStr(), note: '' },
    );
    setError('');
    setStaged([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editing?.id]);

  const currency = debt?.currency ?? 'SAR';
  // Outstanding without the entry being edited — the baseline this entry applies to.
  const baseline = debt ? debt.amount + debt.adjustmentSum - (editing?.amount ?? 0) : 0;
  const parsed = parseFloat(values.amount);
  const hasAmount = !Number.isNaN(parsed) && parsed > 0;
  const after = baseline + (hasAmount ? (values.direction === 'reduce' ? -parsed : parsed) : 0);
  const settles = hasAmount && after <= MONEY_EPSILON && after >= -MONEY_EPSILON;

  const close = () => {
    staged.forEach(discardStagedFile);
    setStaged([]);
    onClose();
  };

  const onValid: SubmitHandler<FormValues> = (submitted) => {
    if (!debt) return;
    const amount = parseFloat(submitted.amount);
    const signedAmount = submitted.direction === 'reduce' ? -amount : amount;
    const result = baseline + signedAmount;
    if (result < -MONEY_EPSILON) {
      setError(
        t('adjustment.error.overpay', {
          amount: formatOriginalMoney(Math.max(baseline, 0), currency),
        }),
      );
      return;
    }
    const wasOpen = debt.status !== 'settled';

    try {
      let adjustmentId: number;
      if (editing) {
        updateAdjustment(editing.id, {
          amount: signedAmount,
          date: submitted.date,
          note: submitted.note,
        });
        adjustmentId = editing.id;
      } else {
        adjustmentId = addAdjustment({
          debtId: debt.id,
          amount: signedAmount,
          date: submitted.date,
          note: submitted.note,
        });
      }
      if (staged.length > 0) {
        const proofs = staged;
        // The entry is saved either way; a proof that fails to land is dropped.
        void addAttachments(debt.id, proofs, adjustmentId).catch(() =>
          proofs.forEach(discardStagedFile),
        );
      }
    } catch {
      setError(t('debtModal.error.save'));
      return;
    }

    setStaged([]);
    onClose();
    if (wasOpen && result <= MONEY_EPSILON) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSettled(debt);
    }
  };

  const onInvalid: SubmitErrorHandler<FormValues> = (errors) => {
    setError(errors.amount ? t('adjustment.error.amount') : t('adjustment.error.date'));
  };

  const handleDelete = () => {
    setConfirmDelete(false);
    if (!editing) return;
    // Removing a top-up can leave the remaining payments larger than the debt.
    if (baseline < -MONEY_EPSILON) {
      setError(t('adjustment.error.deleteWouldOverpay'));
      return;
    }
    deleteAdjustment(editing.id);
    close();
  };

  return (
    <>
      <GlassModal
        visible={visible}
        onClose={close}
        title={editing ? t('adjustment.editTitle') : t('adjustment.createTitle')}
      >
        {debt ? (
          <>
            <Text style={{ textAlign: 'center', fontSize: 11.5, color: theme.textTertiary }}>
              {`${formatDebtId(debt.id)} · ${debt.name}`}
            </Text>
            {error ? (
              <InlineBanner
                kind="error"
                message={error}
                onDismiss={() => setError('')}
                autoDismissMs={4000}
              />
            ) : null}

            <SegmentedControl<AdjustmentDirection>
              size="large"
              options={[
                {
                  label: t(`adjustment.reduce.${debt.type}`),
                  value: 'reduce',
                  icon: Minus,
                  tint: SEMANTIC.positive,
                },
                {
                  label: t('adjustment.increase'),
                  value: 'increase',
                  icon: Plus,
                  tint: SEMANTIC.negative,
                },
              ]}
              value={values.direction}
              onChange={(direction) => {
                setValue('direction', direction);
                setError('');
              }}
            />

            <AmountInput
              label={t('adjustment.amountLabel')}
              value={values.amount}
              onChangeValue={(v) => {
                setValue('amount', v);
                setError('');
              }}
              currencyCode={currency}
              tint={values.direction === 'reduce' ? 'positive' : 'negative'}
            />

            <FormField label={t('adjustment.dateLabel')}>
              <TextField
                value={values.date}
                onChangeText={(v) => setValue('date', v)}
                placeholder="YYYY-MM-DD"
              />
            </FormField>

            <FormField label={t('adjustment.noteLabel')}>
              <TextField
                value={values.note}
                onChangeText={(v) => setValue('note', v)}
                placeholder={t('adjustment.notePlaceholder')}
                multiline
                textAlignVertical="top"
                style={{ minHeight: 60 }}
              />
            </FormField>

            {editing ? (
              // An existing entry's proofs are already saved — changes apply immediately.
              <SavedAttachmentsField
                debtId={debt.id}
                adjustmentId={editing.id}
                onError={setError}
              />
            ) : (
              <StagedAttachmentsField staged={staged} setStaged={setStaged} onError={setError} />
            )}

            {settles ? (
              <InlineBanner kind="success" message={t('adjustment.previewSettles')} />
            ) : (
              <Text style={{ textAlign: 'center', fontSize: 12, color: theme.textSecondary }}>
                {t('adjustment.preview', {
                  amount: formatOriginalMoney(Math.max(after, 0), currency),
                })}
              </Text>
            )}

            <GradientButton
              label={t('adjustment.save')}
              onPress={handleSubmit(onValid, onInvalid)}
            />

            {editing ? (
              <SecondaryButton
                variant="link"
                icon={Trash2}
                color={SEMANTIC.negative}
                label={t('adjustment.delete')}
                onPress={() => setConfirmDelete(true)}
              />
            ) : null}
          </>
        ) : null}
      </GlassModal>

      <ConfirmModal
        visible={confirmDelete}
        title={t('debtDetail.deleteAdjustmentTitle')}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
      />
    </>
  );
}
