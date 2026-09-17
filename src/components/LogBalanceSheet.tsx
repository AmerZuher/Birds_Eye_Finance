import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useForm } from 'react-hook-form';
import type { SubmitErrorHandler, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { FormField, TextField } from '@/components/FormField';
import { AmountInput } from '@/components/ui/AmountInput';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { GlassModal } from '@/components/ui/GlassModal';
import { GradientButton } from '@/components/ui/GradientButton';
import { InlineBanner } from '@/components/ui/InlineBanner';
import { useBalance } from '@/context/BalanceContext';
import { useChrome } from '@/context/ChromeContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';

const formSchema = z.object({
  amount: z.string().refine(
    (value) => {
      const parsed = parseFloat(value);
      // Zero is a real balance; negative is not, and an empty field isn't an answer.
      return value.trim().length > 0 && !Number.isNaN(parsed) && parsed >= 0;
    },
    { message: 'amount' },
  ),
  currency: z.string(),
  note: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

/**
 * The reconciliation entry point (FEATURE_SPEC Part 9): one total for
 * everything the user actually has, dated today. Not per account — the
 * account breakdown lives in Edit Profile (3.3), and this has to stay quick
 * enough to repeat every month.
 *
 * Mounted once at the root and opened through ChromeContext, since three
 * places open the same sheet: the FAB on Dashboard and Analytics (0.1), the
 * Current balance hero (7.3), and the stale-balance nudge (7.4).
 */
export function LogBalanceSheet() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { baseCurrency, currencyOptions, formatOriginalMoney, recordCurrencyUsage } = useCurrency();
  const { logBalance, todaysLog } = useBalance();
  const { logBalanceOpen, closeLogBalance } = useChrome();

  const { watch, setValue, reset, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { amount: '', currency: baseCurrency, note: '' },
  });
  const values = watch();

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);

  // Reopening starts from today's log when there is one — saving again
  // corrects it rather than adding a second row for the same day (9.4).
  useEffect(() => {
    if (!logBalanceOpen) return;
    reset(
      todaysLog
        ? {
            amount: String(todaysLog.amount),
            currency: todaysLog.currency,
            note: todaysLog.note ?? '',
          }
        : { amount: '', currency: baseCurrency, note: '' },
    );
    setError('');
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logBalanceOpen, todaysLog?.id]);

  const onValid: SubmitHandler<FormValues> = (submitted) => {
    setSaving(true);
    logBalance({
      amount: parseFloat(submitted.amount),
      currency: submitted.currency,
      note: submitted.note,
    })
      .then(() => {
        recordCurrencyUsage(submitted.currency);
        closeLogBalance();
      })
      .catch(() => setError(t('logBalance.error.save')))
      .finally(() => setSaving(false));
  };

  const onInvalid: SubmitErrorHandler<FormValues> = () => {
    setError(t('logBalance.error.amount'));
  };

  return (
    <GlassModal visible={logBalanceOpen} onClose={closeLogBalance} title={t('logBalance.title')}>
      <Text style={{ textAlign: 'center', fontSize: 11.5, color: theme.textTertiary }}>
        {t('logBalance.subtitle')}
      </Text>

      {error ? (
        <InlineBanner
          kind="error"
          message={error}
          onDismiss={() => setError('')}
          autoDismissMs={4000}
        />
      ) : null}

      <AmountInput
        label={t('logBalance.amountLabel')}
        value={values.amount}
        onChangeValue={(v) => {
          setValue('amount', v);
          setError('');
        }}
        currencyCode={values.currency}
        onPressCurrency={() => setCurrencyPickerOpen(true)}
      />
      <CustomSelect
        value={values.currency}
        options={currencyOptions}
        onChange={(v) => {
          setValue('currency', v);
          recordCurrencyUsage(v);
          setError('');
        }}
        searchable
        searchPlaceholder={t('settings.searchCurrency')}
        sheetTitle={t('logBalance.currencyTitle')}
        open={currencyPickerOpen}
        onOpenChange={setCurrencyPickerOpen}
        hideTrigger
      />

      <FormField label={t('logBalance.noteLabel')}>
        <TextField
          value={values.note}
          onChangeText={(v) => setValue('note', v)}
          placeholder={t('logBalance.notePlaceholder')}
        />
      </FormField>

      {/* The date isn't a field: a log answers "what do I have now" (9.2). */}
      <Text style={{ textAlign: 'center', fontSize: 12, color: theme.textSecondary }}>
        {todaysLog
          ? t('logBalance.replaces', {
              amount: formatOriginalMoney(todaysLog.amount, todaysLog.currency),
            })
          : t('logBalance.datedToday')}
      </Text>

      <GradientButton
        label={t('logBalance.save')}
        onPress={handleSubmit(onValid, onInvalid)}
        disabled={saving}
      />
    </GlassModal>
  );
}
