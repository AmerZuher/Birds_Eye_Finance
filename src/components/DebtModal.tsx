import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useForm } from 'react-hook-form';
import type { SubmitErrorHandler, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TrendingDown, TrendingUp, Users, X } from 'lucide-react-native';

import { GlassModal } from '@/components/ui/GlassModal';
import { GradientButton } from '@/components/ui/GradientButton';
import { AmountInput } from '@/components/ui/AmountInput';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { InlineBanner } from '@/components/ui/InlineBanner';
import { IconButton } from '@/components/ui/IconButton';
import { Avatar } from '@/components/ui/Avatar';
import { ContactsPicker } from '@/components/ContactsPicker';
import type { PickedContact } from '@/components/ContactsPicker';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useFinance } from '@/context/FinanceContext';
import type { Debt, NewDebt } from '@/db/schema';
import { BORDER, RADII, SEMANTIC, TEXT } from '@/constants/theme';

// Built from local Date components (never toISOString/UTC parsing) — a
// timezone with a positive UTC offset would otherwise shift "today" or a
// user-typed date back a day when round-tripped through UTC.
function todayStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isValidDateStr(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

const formSchema = z
  .object({
    name: z.string(),
    type: z.enum(['positive', 'negative']),
    amount: z.string(),
    currency: z.string(),
    date: z.string(),
    notes: z.string(),
    monthlyPayment: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    phone: z.string(),
    email: z.string(),
    company: z.string(),
    avatar: z.string(),
    contactId: z.string(),
  })
  .superRefine((data, ctx) => {
    if (!data.name.trim()) {
      ctx.addIssue({ code: 'custom', path: ['name'], message: 'name required' });
    }
    const amount = parseFloat(data.amount);
    if (!data.amount.trim() || Number.isNaN(amount) || amount <= 0) {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'amount required' });
    }
    if (!isValidDateStr(data.date)) {
      ctx.addIssue({ code: 'custom', path: ['date'], message: 'invalid date' });
    }
    const monthly = parseFloat(data.monthlyPayment);
    const hasInstallment = data.type === 'negative' && !Number.isNaN(monthly) && monthly > 0;
    if (hasInstallment) {
      if (!isValidDateStr(data.startDate)) {
        ctx.addIssue({ code: 'custom', path: ['startDate'], message: 'invalid start date' });
      }
      if (data.endDate.trim() && !isValidDateStr(data.endDate)) {
        ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'invalid end date' });
      }
    }
  });

type FormValues = z.infer<typeof formSchema>;

const EMPTY_VALUES: FormValues = {
  name: '',
  type: 'negative',
  amount: '',
  currency: 'SAR',
  date: '',
  notes: '',
  monthlyPayment: '',
  startDate: '',
  endDate: '',
  phone: '',
  email: '',
  company: '',
  avatar: '',
  contactId: '',
};

export interface DebtPrefill {
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  avatar?: string;
  contactId?: string;
}

interface DebtModalProps {
  visible: boolean;
  onClose: () => void;
  editingDebt: Debt | null;
  /** Create-mode only — pre-fills identity fields when opened from a person's detail view. */
  prefill?: DebtPrefill | null;
}

/**
 * Create/edit form for a single debt transaction (FEATURE_SPEC 1.7). Always
 * mounted by the caller — GlassModal itself gates visibility (Part 4).
 * Every field is driven by `watch`/`setValue` rather than `Controller`: none
 * of the inputs here are ref-forwarding native inputs, so the plain
 * watch/setValue pair is the simpler controlled-form shape while still going
 * through react-hook-form + zod for validation (CLAUDE.md rule 5).
 */
export function DebtModal({ visible, onClose, editingDebt, prefill }: DebtModalProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { currencies, baseCurrency } = useCurrency();
  const { groupedDebts, addDebt, updateDebt } = useFinance();

  const { watch, setValue, reset, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY_VALUES,
  });

  const [formError, setFormError] = useState('');
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const [contactsPickerOpen, setContactsPickerOpen] = useState(false);
  const [linkedName, setLinkedName] = useState<string | null>(null);
  const [nameFocused, setNameFocused] = useState(false);

  const values = watch();
  const monthlyPaymentNum = parseFloat(values.monthlyPayment);
  const showInstallmentPanel =
    values.type === 'negative' && !Number.isNaN(monthlyPaymentNum) && monthlyPaymentNum > 0;

  useEffect(() => {
    if (!visible) return;
    if (editingDebt) {
      reset({
        name: editingDebt.name,
        type: editingDebt.type,
        amount: String(editingDebt.amount),
        currency: editingDebt.currency ?? baseCurrency,
        date: editingDebt.date,
        notes: editingDebt.notes ?? '',
        monthlyPayment: editingDebt.monthlyPayment ? String(editingDebt.monthlyPayment) : '',
        startDate: editingDebt.startDate ?? '',
        endDate: editingDebt.endDate ?? '',
        phone: editingDebt.phone ?? '',
        email: editingDebt.email ?? '',
        company: editingDebt.company ?? '',
        avatar: editingDebt.avatar ?? '',
        contactId: editingDebt.contactId ?? '',
      });
      setLinkedName(editingDebt.contactId ? editingDebt.name : null);
    } else {
      reset({
        ...EMPTY_VALUES,
        currency: baseCurrency,
        date: todayStr(),
        name: prefill?.name ?? '',
        phone: prefill?.phone ?? '',
        email: prefill?.email ?? '',
        company: prefill?.company ?? '',
        avatar: prefill?.avatar ?? '',
        contactId: prefill?.contactId ?? '',
      });
      setLinkedName(prefill?.contactId ? prefill.name : null);
    }
    setFormError('');
    setCurrencyPickerOpen(false);
    setContactsPickerOpen(false);
    setNameFocused(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editingDebt]);

  // Start date defaults to today the moment the installment panel first
  // appears, same as the top-level Date field — only fires on the
  // false→true edge (via showInstallmentPanel alone in the deps), so it
  // never overwrites a value the user already typed or is editing.
  useEffect(() => {
    if (showInstallmentPanel && !values.startDate) {
      setValue('startDate', todayStr());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInstallmentPanel]);

  const suggestions = useMemo(() => {
    const q = values.name.trim().toLowerCase();
    if (!q || !nameFocused) return [];
    return groupedDebts
      .map((g) => g.name)
      .filter((name) => name.toLowerCase().startsWith(q) && name.toLowerCase() !== q)
      .slice(0, 5);
  }, [groupedDebts, values.name, nameFocused]);

  const clearError = () => {
    if (formError) setFormError('');
  };

  const updateName = (next: string) => {
    setValue('name', next);
    clearError();
    // Manual edits after a contact import clear the link — manual entry stays authoritative (1.7).
    if (linkedName && next !== linkedName) {
      setValue('contactId', '');
      setValue('avatar', '');
      setLinkedName(null);
    }
  };

  const handleContactSelect = (contact: PickedContact) => {
    setValue('name', contact.name);
    setValue('phone', contact.phone ?? '');
    setValue('email', contact.email ?? '');
    setValue('company', contact.company ?? '');
    setValue('avatar', contact.avatar ?? '');
    setValue('contactId', contact.contactId);
    setLinkedName(contact.name);
    setContactsPickerOpen(false);
    clearError();
  };

  const handleUnlink = () => {
    setValue('contactId', '');
    setValue('avatar', '');
    setLinkedName(null);
  };

  const onValid: SubmitHandler<FormValues> = async (submitted) => {
    const amount = parseFloat(submitted.amount);
    const monthlyPayment =
      submitted.type === 'negative' ? parseFloat(submitted.monthlyPayment) || 0 : 0;
    const hasInstallment = submitted.type === 'negative' && monthlyPayment > 0;

    const payload: Omit<NewDebt, 'id'> = {
      name: submitted.name.trim(),
      amount,
      monthlyPayment,
      type: submitted.type,
      date: submitted.date,
      notes: submitted.notes.trim() || undefined,
      startDate: hasInstallment ? submitted.startDate : undefined,
      endDate: hasInstallment ? submitted.endDate.trim() || undefined : undefined,
      currency: submitted.currency,
      phone: submitted.phone.trim() || undefined,
      email: submitted.email.trim() || undefined,
      company: submitted.company.trim() || undefined,
      avatar: submitted.avatar || undefined,
      contactId: submitted.contactId || undefined,
    };

    if (editingDebt) {
      await updateDebt(editingDebt.id, payload);
    } else {
      await addDebt(payload);
    }
    onClose();
  };

  const onInvalid: SubmitErrorHandler<FormValues> = (errors) => {
    const key = Object.keys(errors)[0];
    setFormError(t(`debtModal.error.${key}`) || t('debtModal.error.generic'));
  };

  const currencyOptions = currencies.map((c) => ({ label: c.code, value: c.code }));

  const inputStyle = {
    fontSize: 13,
    color: TEXT.primary,
    backgroundColor: theme.surfaceAlt,
    borderRadius: RADII.field,
    borderWidth: 1,
    borderColor: BORDER.hairline,
    paddingHorizontal: 12,
    paddingVertical: 10,
  } as const;

  return (
    <>
      <GlassModal
        visible={visible}
        onClose={onClose}
        title={editingDebt ? t('debtModal.editTitle') : t('debtModal.createTitle')}
      >
        {formError ? (
          <InlineBanner
            kind="error"
            message={formError}
            onDismiss={() => setFormError('')}
            autoDismissMs={4000}
          />
        ) : null}

        {values.contactId ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              padding: 10,
              borderRadius: RADII.field,
              backgroundColor: theme.surfaceAlt,
              borderWidth: 1,
              borderColor: BORDER.hairline,
            }}
          >
            <Avatar
              name={values.name || undefined}
              photoUri={values.avatar || undefined}
              size={32}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{ fontSize: 12.5, fontWeight: '700', color: TEXT.primary }}
              >
                {values.name}
              </Text>
              {values.phone ? (
                <Text style={{ fontSize: 10.5, color: TEXT.tertiary }}>{values.phone}</Text>
              ) : null}
            </View>
            <IconButton
              icon={X}
              accessibilityLabel={t('debtModal.unlink')}
              size={28}
              iconSize={13}
              onPress={handleUnlink}
            />
          </View>
        ) : (
          <Pressable
            onPress={() => setContactsPickerOpen(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 11,
              borderRadius: RADII.field,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: BORDER.hairline,
            }}
          >
            <Users size={14} color={theme.accent2} />
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.accent2 }}>
              {t('debtModal.importContact')}
            </Text>
          </Pressable>
        )}

        <View>
          <TextInput
            value={values.name}
            onChangeText={updateName}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setTimeout(() => setNameFocused(false), 120)}
            placeholder={t('debtModal.namePlaceholder')}
            placeholderTextColor={TEXT.tertiary}
            style={inputStyle}
          />
          {suggestions.length > 0 ? (
            <View
              style={{
                marginTop: 4,
                borderRadius: RADII.field,
                backgroundColor: theme.surfaceAlt,
                borderWidth: 1,
                borderColor: BORDER.hairline,
                overflow: 'hidden',
              }}
            >
              {suggestions.map((name) => (
                <Pressable
                  key={name}
                  onPress={() => {
                    updateName(name);
                    setNameFocused(false);
                  }}
                  style={{
                    paddingVertical: 9,
                    paddingHorizontal: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: BORDER.hairlineSoft,
                  }}
                >
                  <Text style={{ fontSize: 12.5, color: TEXT.primary }}>{name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {/* "I owe" vs "Owed to me" drives every other field's tint and the
            installment panel — the single most consequential choice in this
            form, so it gets full-width colored buttons rather than the
            compact SegmentedControl used elsewhere. */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {(['negative', 'positive'] as const).map((type) => {
            const active = values.type === type;
            const color = type === 'negative' ? SEMANTIC.negative : SEMANTIC.positive;
            const Icon = type === 'negative' ? TrendingDown : TrendingUp;
            return (
              <Pressable
                key={type}
                onPress={() => {
                  setValue('type', type);
                  clearError();
                }}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  paddingVertical: 14,
                  borderRadius: RADII.field,
                  backgroundColor: active ? `${color}22` : theme.surfaceAlt,
                  borderWidth: 1.5,
                  borderColor: active ? color : BORDER.hairline,
                }}
              >
                <Icon size={16} color={active ? color : TEXT.tertiary} strokeWidth={2.4} />
                <Text
                  style={{
                    fontSize: 13.5,
                    fontWeight: '800',
                    color: active ? color : TEXT.secondary,
                  }}
                >
                  {t(`debts.type.${type}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <AmountInput
          label={t('debtModal.amountLabel')}
          value={values.amount}
          onChangeValue={(v) => {
            setValue('amount', v);
            clearError();
          }}
          currencyCode={values.currency}
          onPressCurrency={() => setCurrencyPickerOpen(true)}
          tint={values.type}
        />
        <CustomSelect
          value={values.currency}
          options={currencyOptions}
          onChange={(v) => {
            setValue('currency', v);
            clearError();
          }}
          searchable
          searchPlaceholder={t('settings.baseCurrency')}
          sheetTitle={t('settings.baseCurrency')}
          open={currencyPickerOpen}
          onOpenChange={setCurrencyPickerOpen}
          hideTrigger
        />

        <FormField label={t('debtModal.dateLabel')}>
          <TextInput
            value={values.date}
            onChangeText={(v) => {
              setValue('date', v);
              clearError();
            }}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={TEXT.tertiary}
            style={inputStyle}
          />
        </FormField>

        <FormField label={t('debtModal.notesLabel')}>
          <TextInput
            value={values.notes}
            onChangeText={(v) => setValue('notes', v)}
            placeholder={t('debtModal.notesPlaceholder')}
            placeholderTextColor={TEXT.tertiary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={[inputStyle, { minHeight: 70 }]}
          />
        </FormField>

        {/* This whole block resizes as the installment panel toggles in/out
            (and back when Amount/Notes above grows) — layout animates the
            resize smoothly instead of the fields below jumping to their new
            position, and the panel itself fades in/out on top of that. */}
        <Animated.View layout={LinearTransition.duration(220)} style={{ gap: 14 }}>
          {values.type === 'negative' ? (
            <FormField label={t('debtModal.monthlyPaymentLabel')}>
              <TextInput
                value={values.monthlyPayment}
                onChangeText={(v) => {
                  setValue('monthlyPayment', v);
                  clearError();
                }}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={TEXT.tertiary}
                style={inputStyle}
              />
            </FormField>
          ) : null}

          {showInstallmentPanel ? (
            <Animated.View
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(120)}
              style={{ flexDirection: 'row', gap: 10 }}
            >
              <View style={{ flex: 1 }}>
                <FormField label={t('debtModal.startDateLabel')}>
                  <TextInput
                    value={values.startDate}
                    onChangeText={(v) => {
                      setValue('startDate', v);
                      clearError();
                    }}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={TEXT.tertiary}
                    style={inputStyle}
                  />
                </FormField>
              </View>
              <View style={{ flex: 1 }}>
                <FormField label={t('debtModal.endDateLabel')}>
                  <TextInput
                    value={values.endDate}
                    onChangeText={(v) => {
                      setValue('endDate', v);
                      clearError();
                    }}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={TEXT.tertiary}
                    style={inputStyle}
                  />
                </FormField>
              </View>
            </Animated.View>
          ) : null}

          <FormField label={t('debtModal.phoneLabel')}>
            <TextInput
              value={values.phone}
              onChangeText={(v) => setValue('phone', v)}
              keyboardType="phone-pad"
              placeholder={t('debtModal.phonePlaceholder')}
              placeholderTextColor={TEXT.tertiary}
              style={[inputStyle, { textAlign: 'left', writingDirection: 'ltr' }]}
            />
          </FormField>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <FormField label={t('debtModal.emailLabel')}>
                <TextInput
                  value={values.email}
                  onChangeText={(v) => setValue('email', v)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder={t('debtModal.emailPlaceholder')}
                  placeholderTextColor={TEXT.tertiary}
                  style={inputStyle}
                />
              </FormField>
            </View>
            <View style={{ flex: 1 }}>
              <FormField label={t('debtModal.companyLabel')}>
                <TextInput
                  value={values.company}
                  onChangeText={(v) => setValue('company', v)}
                  placeholder={t('debtModal.companyPlaceholder')}
                  placeholderTextColor={TEXT.tertiary}
                  style={inputStyle}
                />
              </FormField>
            </View>
          </View>

          <GradientButton
            label={editingDebt ? t('debtModal.saveButton') : t('debtModal.createButton')}
            onPress={handleSubmit(onValid, onInvalid)}
          />
        </Animated.View>
      </GlassModal>

      <ContactsPicker
        visible={contactsPickerOpen}
        onClose={() => setContactsPickerOpen(false)}
        onSelect={handleContactSelect}
      />
    </>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{
          fontSize: 9.5,
          fontWeight: '700',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: TEXT.tertiary,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}
