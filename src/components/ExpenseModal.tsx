import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useForm } from 'react-hook-form';
import type { SubmitErrorHandler, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LayoutGrid, Pencil } from 'lucide-react-native';

import { GlassModal } from '@/components/ui/GlassModal';
import { GradientButton } from '@/components/ui/GradientButton';
import { AmountInput } from '@/components/ui/AmountInput';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { InlineBanner } from '@/components/ui/InlineBanner';
import { SearchInput } from '@/components/ui/SearchInput';
import { ListRow } from '@/components/ui/ListRow';
import { Badge, FilterChip } from '@/components/ui/Badge';
import { IconTile } from '@/components/ui/IconTile';
import { EmptyState } from '@/components/ui/EmptyState';
import { ExpenseIconTile } from '@/components/ExpenseIconTile';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useFinance } from '@/context/FinanceContext';
import type { Expense, NewExpense } from '@/db/schema';
import { BORDER, RADII, TEXT } from '@/constants/theme';
import type { Period } from '@/lib/period';
import type { ExpenseTemplate } from '@/utils/expenseIcon';
import {
  EXPENSE_CATEGORIES,
  GENERIC_EXPENSE_ICONS,
  lucideIconValue,
  searchTemplates,
} from '@/utils/expenseIcon';

const PERIODS: Period[] = [
  'daily',
  'weekly',
  'monthly',
  '3months',
  '6months',
  '9months',
  'yearly',
  'custom',
];

// Keeps the sheet from visibly growing/shrinking as you switch between the
// Templates and Custom tabs — sized to comfortably fit the taller Custom
// form; shorter states (e.g. a simple monthly template) just leave a little
// trailing space above the submit button instead of resizing the sheet.
const CREATE_MODE_CONTENT_MIN_HEIGHT = 460;

const formSchema = z
  .object({
    name: z.string(),
    amount: z.string(),
    currency: z.string(),
    period: z.string(),
    customPeriodDays: z.string(),
    notes: z.string(),
    category: z.string(),
    icon: z.string(),
  })
  .superRefine((data, ctx) => {
    if (!data.name.trim()) {
      ctx.addIssue({ code: 'custom', path: ['name'], message: 'name required' });
    }
    const amount = parseFloat(data.amount);
    // Unconfigured expenses (amount === 0, FEATURE_SPEC 2.5's "Setup cost"
    // affordance) are deliberately valid — only a blank/negative/NaN amount
    // blocks save.
    if (!data.amount.trim() || Number.isNaN(amount) || amount < 0) {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'amount required' });
    }
    if (data.period === 'custom') {
      const days = parseInt(data.customPeriodDays, 10);
      if (!data.customPeriodDays.trim() || Number.isNaN(days) || days <= 0) {
        ctx.addIssue({ code: 'custom', path: ['customPeriodDays'], message: 'invalid days' });
      }
    }
  });

type FormValues = z.infer<typeof formSchema>;

const EMPTY_VALUES: FormValues = {
  name: '',
  amount: '',
  currency: 'SAR',
  period: 'monthly',
  customPeriodDays: '',
  notes: '',
  category: 'essential',
  icon: '',
};

type CreateMode = 'templates' | 'custom';

interface ExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  editingExpense: Expense | null;
}

/**
 * Create/edit form for a single expense (FEATURE_SPEC 2.7). Create mode
 * offers a Templates tab (browse/search the curated catalog, review +
 * adjust, no icon picker needed — the template's own icon is enough) and a
 * Custom tab (the full manual form). Edit mode always goes straight to the
 * Custom-style full form — there's no "which tab did I pick" question for an
 * already-existing record. Mirrors DebtModal's watch()/setValue() pattern
 * (CLAUDE.md rule 5) — every field here is a controlled primitive too.
 */
export function ExpenseModal({ visible, onClose, editingExpense }: ExpenseModalProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { currencies, baseCurrency, convertToBase } = useCurrency();
  const { expenses, addExpense, updateExpense } = useFinance();

  const { watch, setValue, reset, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY_VALUES,
  });

  const [formError, setFormError] = useState('');
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);
  const [defaultReminderNote, setDefaultReminderNote] = useState('');
  const [mode, setMode] = useState<CreateMode>('templates');
  const [templateSearch, setTemplateSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<ExpenseTemplate | null>(null);

  const values = watch();

  useEffect(() => {
    if (!visible) return;
    if (editingExpense) {
      reset({
        name: editingExpense.name,
        amount: String(editingExpense.amount),
        currency: editingExpense.currency ?? baseCurrency,
        period: editingExpense.period ?? 'monthly',
        customPeriodDays: editingExpense.customPeriodDays
          ? String(editingExpense.customPeriodDays)
          : '',
        notes: editingExpense.notes ?? '',
        category: editingExpense.category,
        icon: editingExpense.icon,
      });
      setDefaultReminderNote('');
    } else {
      reset(EMPTY_VALUES);
      setDefaultReminderNote('');
      setMode('templates');
      setTemplateSearch('');
      setSelectedTemplate(null);
    }
    setFormError('');
    setCurrencyPickerOpen(false);
    setPeriodPickerOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editingExpense]);

  // Notes auto-clears the default reminder placeholder the moment a real
  // amount is set (2.7) — only while the field still holds exactly that
  // placeholder, so it never clobbers something the user typed themselves.
  useEffect(() => {
    const amount = parseFloat(values.amount);
    if (defaultReminderNote && values.notes === defaultReminderNote && amount > 0) {
      setValue('notes', '');
      setDefaultReminderNote('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.amount]);

  // Custom tab keeps its own live name-autocomplete against the same
  // catalog the Templates tab browses — a fast path for "I'm already
  // customizing, but this happens to match a known template" without
  // switching tabs.
  const suggestions = useMemo(
    () => (values.name.trim() ? searchTemplates(values.name, 5) : []),
    [values.name],
  );

  const filteredTemplates = useMemo(() => {
    const results = searchTemplates(templateSearch);
    if (templateSearch.trim()) return results;
    // No search yet — surface the most universally-relevant picks first.
    return [...results].sort((a, b) => Number(!!b.universal) - Number(!!a.universal));
  }, [templateSearch]);

  const clearError = () => {
    if (formError) setFormError('');
  };

  const applyTemplateToForm = (template: ExpenseTemplate) => {
    setValue('name', template.name);
    setValue('category', template.category);
    setValue('period', template.defaultPeriod);
    setValue('icon', template.icon);
    if (template.defaultPriceUSD > 0) {
      const converted = convertToBase(template.defaultPriceUSD, 'USD');
      setValue('amount', converted.toFixed(2));
      setValue('currency', baseCurrency);
      setValue('notes', '');
      setDefaultReminderNote('');
    } else {
      setValue('amount', '');
      const reminder = t('expenseModal.notesReminderDefault');
      setValue('notes', reminder);
      setDefaultReminderNote(reminder);
    }
    clearError();
  };

  const selectTemplate = (template: ExpenseTemplate) => {
    setSelectedTemplate(template);
    applyTemplateToForm(template);
  };

  const onValid: SubmitHandler<FormValues> = async (submitted) => {
    const trimmedName = submitted.name.trim();
    const duplicate = expenses.some(
      (e) =>
        e.id !== editingExpense?.id && e.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    );
    if (duplicate) {
      setFormError(t('expenseModal.error.duplicate'));
      return;
    }

    const amount = parseFloat(submitted.amount) || 0;
    const period = submitted.period as Period;
    const payload: Omit<NewExpense, 'id'> = {
      name: trimmedName,
      amount,
      icon: submitted.icon || 'initial',
      category: submitted.category,
      currency: submitted.currency,
      period,
      customPeriodDays: period === 'custom' ? parseInt(submitted.customPeriodDays, 10) : undefined,
      notes: submitted.notes.trim() || undefined,
    };

    if (editingExpense) {
      await updateExpense(editingExpense.id, payload);
    } else {
      await addExpense(payload);
    }
    onClose();
  };

  const onInvalid: SubmitErrorHandler<FormValues> = (errors) => {
    const key = Object.keys(errors)[0];
    setFormError(t(`expenseModal.error.${key}`) || t('expenseModal.error.generic'));
  };

  const currencyOptions = currencies.map((c) => ({ label: c.code, value: c.code }));
  const periodOptions = PERIODS.map((p) => ({ label: t(`expenses.period.${p}`), value: p }));

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

  const showTemplatesTab = !editingExpense && mode === 'templates';
  const showCustomTab = editingExpense || mode === 'custom';

  // Amount/Period/Notes/Category are identical fields shared by the
  // Templates-review state and the Custom tab — one render function, two
  // callers, so the two paths can't drift apart.
  const renderAdjustableFields = () => (
    <>
      <AmountInput
        label={t('expenseModal.amountLabel')}
        value={values.amount}
        onChangeValue={(v) => {
          setValue('amount', v);
          clearError();
        }}
        currencyCode={values.currency}
        onPressCurrency={() => setCurrencyPickerOpen(true)}
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

      <FormField label={t('expenseModal.periodLabel')}>
        <Pressable
          onPress={() => setPeriodPickerOpen(true)}
          style={[inputStyle, { flexDirection: 'row', justifyContent: 'space-between' }]}
        >
          <Text style={{ fontSize: 13, color: TEXT.primary }}>
            {t(`expenses.period.${values.period}`)}
          </Text>
        </Pressable>
      </FormField>

      {values.period === 'custom' ? (
        <FormField label={t('expenseModal.customDaysLabel')}>
          <TextInput
            value={values.customPeriodDays}
            onChangeText={(v) => {
              setValue('customPeriodDays', v);
              clearError();
            }}
            keyboardType="number-pad"
            placeholder="30"
            placeholderTextColor={TEXT.tertiary}
            style={inputStyle}
          />
        </FormField>
      ) : null}
      <CustomSelect
        value={values.period}
        options={periodOptions}
        onChange={(v) => {
          setValue('period', v);
          clearError();
        }}
        sheetTitle={t('expenseModal.periodLabel')}
        open={periodPickerOpen}
        onOpenChange={setPeriodPickerOpen}
        hideTrigger
      />

      <FormField label={t('expenseModal.notesLabel')}>
        <TextInput
          value={values.notes}
          onChangeText={(v) => setValue('notes', v)}
          placeholder={t('expenseModal.notesPlaceholder')}
          placeholderTextColor={TEXT.tertiary}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          style={[inputStyle, { minHeight: 70 }]}
        />
      </FormField>

      <FormField label={t('expenseModal.categoryLabel')}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingEnd: 4 }}
        >
          {EXPENSE_CATEGORIES.map((category) => (
            <FilterChip
              key={category}
              label={t(`expenses.category.${category}`)}
              active={values.category === category}
              onPress={() => {
                setValue('category', category);
                clearError();
              }}
            />
          ))}
        </ScrollView>
      </FormField>
    </>
  );

  return (
    <GlassModal
      visible={visible}
      onClose={onClose}
      title={editingExpense ? t('expenseModal.editTitle') : t('expenseModal.createTitle')}
    >
      {formError ? (
        <InlineBanner
          kind="error"
          message={formError}
          onDismiss={() => setFormError('')}
          autoDismissMs={4000}
        />
      ) : null}

      {!editingExpense ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {(['templates', 'custom'] as const).map((tab) => {
            const active = mode === tab;
            const Icon = tab === 'templates' ? LayoutGrid : Pencil;
            return (
              <Pressable
                key={tab}
                onPress={() => setMode(tab)}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  paddingVertical: 14,
                  borderRadius: RADII.field,
                  backgroundColor: active ? `${theme.accent1}22` : theme.surfaceAlt,
                  borderWidth: 1.5,
                  borderColor: active ? theme.accent1 : BORDER.hairline,
                }}
              >
                <Icon size={16} color={active ? theme.accent2 : TEXT.tertiary} strokeWidth={2.4} />
                <Text
                  style={{
                    fontSize: 13.5,
                    fontWeight: '800',
                    color: active ? theme.accent2 : TEXT.secondary,
                  }}
                >
                  {t(`expenseModal.tab.${tab}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View
        style={{ minHeight: editingExpense ? undefined : CREATE_MODE_CONTENT_MIN_HEIGHT, gap: 14 }}
      >
        {showTemplatesTab ? (
          selectedTemplate ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <ExpenseIconTile
                  icon={selectedTemplate.icon}
                  name={selectedTemplate.name}
                  size={44}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: TEXT.primary }}>
                    {selectedTemplate.name}
                  </Text>
                  <Text style={{ fontSize: 11, color: TEXT.tertiary, marginTop: 1 }}>
                    {t(`expenses.category.${selectedTemplate.category}`)}
                  </Text>
                </View>
                <Pressable onPress={() => setSelectedTemplate(null)} hitSlop={8}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: theme.accent2 }}>
                    {t('expenseModal.changeTemplate')}
                  </Text>
                </Pressable>
              </View>
              {renderAdjustableFields()}
            </>
          ) : (
            <>
              <SearchInput
                value={templateSearch}
                onChangeText={setTemplateSearch}
                placeholder={t('expenseModal.templateSearchPlaceholder')}
              />
              {filteredTemplates.length === 0 ? (
                <EmptyState caption={t('expenseModal.noTemplatesFound')} />
              ) : (
                <View
                  style={{
                    borderRadius: RADII.field,
                    backgroundColor: theme.surfaceAlt,
                    borderWidth: 1,
                    borderColor: BORDER.hairline,
                    overflow: 'hidden',
                  }}
                >
                  {filteredTemplates.map((template, index) => (
                    <ListRow
                      key={template.name}
                      leading={
                        <ExpenseIconTile icon={template.icon} name={template.name} size={34} />
                      }
                      title={template.name}
                      subtitle={
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            marginTop: 3,
                          }}
                        >
                          <Badge
                            label={t(`expenses.category.${template.category}`)}
                            variant="accent"
                          />
                          <Badge label={t(`expenses.period.${template.defaultPeriod}`)} />
                        </View>
                      }
                      onPress={() => selectTemplate(template)}
                      showBottomBorder={index < filteredTemplates.length - 1}
                    />
                  ))}
                </View>
              )}
            </>
          )
        ) : null}

        {showCustomTab ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <ExpenseIconTile icon={values.icon || 'initial'} name={values.name} size={44} />
              <View style={{ flex: 1 }}>
                <TextInput
                  value={values.name}
                  onChangeText={(v) => {
                    setValue('name', v);
                    clearError();
                  }}
                  placeholder={t('expenseModal.namePlaceholder')}
                  placeholderTextColor={TEXT.tertiary}
                  style={inputStyle}
                />
              </View>
            </View>

            {suggestions.length > 0 ? (
              <View
                style={{
                  borderRadius: RADII.field,
                  backgroundColor: theme.surfaceAlt,
                  borderWidth: 1,
                  borderColor: BORDER.hairline,
                  overflow: 'hidden',
                }}
              >
                {suggestions.map((template) => (
                  <Pressable
                    key={template.name}
                    onPress={() => applyTemplateToForm(template)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingVertical: 9,
                      paddingHorizontal: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: BORDER.hairlineSoft,
                    }}
                  >
                    <ExpenseIconTile icon={template.icon} name={template.name} size={26} />
                    <Text style={{ fontSize: 12.5, color: TEXT.primary }}>{template.name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {renderAdjustableFields()}

            <FormField label={t('expenseModal.iconLabel')}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {GENERIC_EXPENSE_ICONS.map(({ key, Icon }) => {
                  const iconValue = lucideIconValue(key);
                  const active = values.icon === iconValue;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => {
                        setValue('icon', iconValue);
                        clearError();
                      }}
                    >
                      <IconTile backgroundColor={active ? `${theme.accent1}33` : undefined}>
                        <Icon size={16} color={active ? theme.accent2 : TEXT.secondary} />
                      </IconTile>
                    </Pressable>
                  );
                })}
              </View>
            </FormField>
          </>
        ) : null}
      </View>

      <GradientButton
        label={editingExpense ? t('expenseModal.saveButton') : t('expenseModal.createButton')}
        onPress={handleSubmit(onValid, onInvalid)}
      />
    </GlassModal>
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
