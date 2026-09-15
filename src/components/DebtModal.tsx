import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useForm } from 'react-hook-form';
import type { SubmitErrorHandler, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CalendarClock,
  TrendingDown,
  TrendingUp,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native';

import { ContactsPicker } from '@/components/ContactsPicker';
import type { PickedContact } from '@/components/ContactsPicker';
import { StagedAttachmentsField } from '@/components/DebtAttachments';
import { FormField, TextField } from '@/components/FormField';
import { AmountInput } from '@/components/ui/AmountInput';
import { Avatar } from '@/components/ui/Avatar';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { GlassModal } from '@/components/ui/GlassModal';
import { GradientButton } from '@/components/ui/GradientButton';
import { IconButton } from '@/components/ui/IconButton';
import { InlineBanner } from '@/components/ui/InlineBanner';
import type { BannerKind } from '@/components/ui/InlineBanner';
import { ListRow } from '@/components/ui/ListRow';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { useCurrency } from '@/context/CurrencyContext';
import { useDebts } from '@/context/DebtsContext';
import type { DebtInput, DebtPersonTarget, DebtView } from '@/context/DebtsContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { RADII, SEMANTIC } from '@/constants/theme';
import type { Person } from '@/db/schema';
import { discardStagedFile } from '@/lib/attachments';
import type { StagedFile } from '@/lib/attachments';
import { avatarDisplayUri } from '@/lib/avatars';
import { isValidDateStr, todayStr } from '@/lib/dates';
import { MONEY_EPSILON } from '@/lib/debtStatus';
import { phoneTail, resolvePerson, suggestPeople } from '@/lib/people';
import { withAlpha } from '@/utils/color';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

const formSchema = z
  .object({
    personId: z.number().nullable(),
    name: z.string(),
    type: z.enum(['positive', 'negative']),
    amount: z.string(),
    currency: z.string(),
    date: z.string(),
    notes: z.string(),
    monthlyPayment: z.string(),
    startDate: z.string(),
    endDate: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.personId == null && !data.name.trim()) {
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
  personId: null,
  name: '',
  type: 'negative',
  amount: '',
  currency: 'SAR',
  date: '',
  notes: '',
  monthlyPayment: '',
  startDate: '',
  endDate: '',
};

const ERROR_KEYS: Record<string, string> = {
  name: 'debtModal.error.name',
  amount: 'debtModal.error.amount',
  date: 'debtModal.error.date',
  startDate: 'debtModal.error.startDate',
  endDate: 'debtModal.error.endDate',
};

export interface DebtPrefill {
  personId: number;
}

interface DebtModalProps {
  visible: boolean;
  onClose: () => void;
  editingDebt: DebtView | null;
  /** Create mode only — opened from a person's page, the person is fixed. */
  prefill?: DebtPrefill | null;
  /** Edit mode only — the caller owns the ConfirmModal/deleteDebt call. */
  onRequestDelete?: () => void;
}

/**
 * Create/edit form for a single debt (FEATURE_SPEC 1.7). Contact details are
 * not fields here — they belong to the person (1.3, 1.11). The person block
 * binds a personId: from a person's page it's fixed; otherwise the typed name
 * gets live suggestions, and an unbound name is resolved on blur and again on
 * save — exactly one namesake binds automatically (visibly, with a way out),
 * several require a pick, none creates a new person. Saving only ever writes
 * that personId, so a second debt for "Ahmed" lands under the same Ahmed.
 *
 * Driven by `watch`/`setValue` (every field is a controlled primitive), still
 * validated through react-hook-form + zod (CLAUDE.md rule 5).
 */
export function DebtModal({
  visible,
  onClose,
  editingDebt,
  prefill,
  onRequestDelete,
}: DebtModalProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { currencies, baseCurrency, recordCurrencyUsage, formatOriginalMoney } = useCurrency();
  const { people, peopleById, debtViews, addDebt, updateDebt, updatePerson, addAttachments } =
    useDebts();

  const { watch, setValue, reset, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY_VALUES,
  });

  const [notice, setNotice] = useState<{ kind: BannerKind; message: string } | null>(null);
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const [contactsPickerOpen, setContactsPickerOpen] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  // The user explicitly asked for a new person — skip name matching (strong keys still apply).
  const [forceNewPerson, setForceNewPerson] = useState(false);
  // Bound by name resolution rather than an explicit pick — shown with "Not this person?".
  const [autoBound, setAutoBound] = useState(false);
  const [pendingContact, setPendingContact] = useState<PickedContact | null>(null);
  const [staged, setStaged] = useState<StagedFile[]>([]);

  const values = watch();
  const monthlyPaymentNum = parseFloat(values.monthlyPayment);
  const showInstallmentPanel =
    values.type === 'negative' && !Number.isNaN(monthlyPaymentNum) && monthlyPaymentNum > 0;
  const personLocked = !!editingDebt || prefill?.personId != null;
  const boundPerson = values.personId != null ? (peopleById.get(values.personId) ?? null) : null;

  useEffect(() => {
    if (!visible) return;
    if (editingDebt) {
      reset({
        personId: editingDebt.personId ?? null,
        name: editingDebt.name,
        type: editingDebt.type,
        amount: String(editingDebt.amount),
        currency: editingDebt.currency ?? baseCurrency,
        date: editingDebt.date,
        notes: editingDebt.notes ?? '',
        monthlyPayment: editingDebt.monthlyPayment ? String(editingDebt.monthlyPayment) : '',
        startDate: editingDebt.startDate ?? '',
        endDate: editingDebt.endDate ?? '',
      });
    } else {
      const prefillPerson =
        prefill?.personId != null ? peopleById.get(prefill.personId) : undefined;
      reset({
        ...EMPTY_VALUES,
        currency: baseCurrency,
        date: todayStr(),
        personId: prefillPerson?.id ?? null,
        name: prefillPerson?.name ?? '',
      });
    }
    setNotice(null);
    setCurrencyPickerOpen(false);
    setContactsPickerOpen(false);
    setNameFocused(false);
    setForceNewPerson(false);
    setAutoBound(false);
    setPendingContact(null);
    setStaged([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editingDebt]);

  // Start date defaults to today the moment the installment panel first
  // appears — only on the false→true edge, so it never overwrites a typed value.
  useEffect(() => {
    if (showInstallmentPanel && !values.startDate) {
      setValue('startDate', todayStr());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInstallmentPanel]);

  const debtCountByPerson = useMemo(() => {
    const counts = new Map<number, number>();
    for (const debt of debtViews) {
      if (debt.personId != null) counts.set(debt.personId, (counts.get(debt.personId) ?? 0) + 1);
    }
    return counts;
  }, [debtViews]);

  const resolution = useMemo(() => {
    if (boundPerson || !values.name.trim()) return null;
    return resolvePerson(
      { name: values.name, phone: pendingContact?.phone, contactId: pendingContact?.contactId },
      people,
      { skipNameMatch: forceNewPerson },
    );
  }, [boundPerson, values.name, pendingContact, people, forceNewPerson]);

  const suggestions = useMemo(() => {
    if (!nameFocused || boundPerson) return [];
    return suggestPeople(values.name, people, 5);
  }, [nameFocused, boundPerson, values.name, people]);

  const disambiguator = (person: Person): string =>
    phoneTail(person.phone) ??
    person.company ??
    t('debtModal.debtCount', { count: debtCountByPerson.get(person.id) ?? 0 });

  const bindPerson = (person: Person, auto: boolean) => {
    setValue('personId', person.id);
    setValue('name', person.name);
    setAutoBound(auto);
    setForceNewPerson(false);
    setNameFocused(false);
  };

  const unbindPerson = (asNewPerson: boolean) => {
    setValue('personId', null);
    setAutoBound(false);
    setForceNewPerson(asNewPerson);
  };

  const updateName = (next: string) => {
    setValue('name', next);
    setForceNewPerson(false);
    setNotice(null);
    // An imported contact belongs to the name it came with — editing the name
    // away from it drops the link (manual entry stays authoritative, 1.7).
    if (pendingContact && next.trim() !== pendingContact.name.trim()) setPendingContact(null);
  };

  const handleNameBlur = () => {
    const resolvedAtBlur = resolution;
    setTimeout(() => {
      setNameFocused(false);
      if (resolvedAtBlur?.kind === 'existing' && resolvedAtBlur.matchedBy === 'name') {
        bindPerson(resolvedAtBlur.person, true);
      }
    }, 120);
  };

  const handleContactSelect = (contact: PickedContact) => {
    setContactsPickerOpen(false);
    const match = resolvePerson(
      { name: contact.name, phone: contact.phone, contactId: contact.contactId },
      people,
    );
    if (match.kind === 'existing' && match.matchedBy !== 'name') {
      bindPerson(match.person, false);
      setPendingContact(null);
      setNotice({
        kind: 'warning',
        message: t('debtModal.contactBelongsTo', { name: match.person.name }),
      });
      return;
    }
    setValue('personId', null);
    setValue('name', contact.name);
    setPendingContact(contact);
    setForceNewPerson(false);
    setNotice(null);
    // A single phone-less namesake: bind visibly — the contact fills their empty details on save.
    if (match.kind === 'existing') bindPerson(match.person, true);
    else setAutoBound(false);
  };

  // When a contact was imported but the debt goes to an existing person, the
  // contact only fills that person's empty details — never overwrites them.
  const fillMissingDetails = (personId: number, contact: PickedContact) => {
    const person = peopleById.get(personId);
    if (!person) return;
    try {
      updatePerson(person.id, {
        name: person.name,
        phone: person.phone ?? contact.phone,
        email: person.email ?? contact.email,
        company: person.company ?? contact.company,
        avatar: person.avatar ?? contact.avatar,
        contactId: person.contactId ?? contact.contactId,
      });
    } catch {
      // A phone/contact owned by someone else stays with its owner; the debt still saves.
    }
  };

  const handleClose = () => {
    staged.forEach(discardStagedFile);
    setStaged([]);
    onClose();
  };

  const onValid: SubmitHandler<FormValues> = (submitted) => {
    const amount = parseFloat(submitted.amount);
    if (editingDebt && amount < editingDebt.paid - MONEY_EPSILON) {
      setNotice({
        kind: 'error',
        message: t('debtModal.error.amountBelowPaid', {
          amount: formatOriginalMoney(editingDebt.paid, submitted.currency),
        }),
      });
      return;
    }
    const monthlyPayment =
      submitted.type === 'negative' ? parseFloat(submitted.monthlyPayment) || 0 : 0;
    const hasInstallment = submitted.type === 'negative' && monthlyPayment > 0;

    // null (not undefined) clears a column — drizzle skips undefined keys in an update.
    const input: DebtInput = {
      amount,
      monthlyPayment,
      type: submitted.type,
      date: submitted.date,
      notes: submitted.notes.trim() || null,
      startDate: hasInstallment ? submitted.startDate : null,
      endDate: hasInstallment ? submitted.endDate.trim() || null : null,
      currency: submitted.currency,
    };

    try {
      if (editingDebt) {
        updateDebt(editingDebt.id, input);
        onClose();
        return;
      }

      let target: DebtPersonTarget;
      if (submitted.personId != null) {
        target = { personId: submitted.personId };
      } else {
        const match = resolvePerson(
          {
            name: submitted.name,
            phone: pendingContact?.phone,
            contactId: pendingContact?.contactId,
          },
          people,
          { skipNameMatch: forceNewPerson },
        );
        if (match.kind === 'ambiguous') {
          setNotice({ kind: 'warning', message: t('debtModal.error.ambiguous') });
          return;
        }
        target =
          match.kind === 'existing'
            ? { personId: match.person.id }
            : {
                newPerson: {
                  name: submitted.name,
                  phone: pendingContact?.phone,
                  email: pendingContact?.email,
                  company: pendingContact?.company,
                  avatar: pendingContact?.avatar,
                  contactId: pendingContact?.contactId,
                },
              };
      }

      if ('personId' in target && pendingContact)
        fillMissingDetails(target.personId, pendingContact);
      const debtId = addDebt(input, target);
      const proofs = staged;
      setStaged([]);
      onClose();
      // The debt is saved at this point. A proof that fails to land is dropped
      // rather than keeping the form open, where a second save would duplicate the debt.
      if (proofs.length > 0) {
        void addAttachments(debtId, proofs).catch(() => proofs.forEach(discardStagedFile));
      }
    } catch {
      setNotice({ kind: 'error', message: t('debtModal.error.save') });
    }
  };

  const onInvalid: SubmitErrorHandler<FormValues> = (errors) => {
    const key = Object.keys(errors)[0];
    setNotice({ kind: 'error', message: t(ERROR_KEYS[key] ?? 'debtModal.error.generic') });
  };

  const currencyOptions = currencies.map((c) => ({ label: c.code, value: c.code }));

  const personBlock = boundPerson ? (
    <PersonCard
      person={boundPerson}
      caption={autoBound ? t('debtModal.addingTo', { name: boundPerson.name }) : undefined}
      trailing={
        personLocked ? null : (
          <SecondaryButton
            variant="link"
            label={t('debtModal.changePerson')}
            onPress={() => unbindPerson(false)}
          />
        )
      }
      footer={
        autoBound && !personLocked ? (
          <SecondaryButton
            variant="link"
            icon={UserPlus}
            label={t('debtModal.notThisPerson')}
            onPress={() => unbindPerson(true)}
          />
        ) : null
      }
    />
  ) : (
    <View style={{ gap: 8 }}>
      <FormField label={t('debtModal.personLabel')}>
        <TextField
          value={values.name}
          onChangeText={updateName}
          onFocus={() => setNameFocused(true)}
          onBlur={handleNameBlur}
          placeholder={t('debtModal.namePlaceholder')}
        />
      </FormField>

      {suggestions.length > 0 ? (
        <PeopleList
          people={suggestions}
          describe={disambiguator}
          onPick={(person) => bindPerson(person, false)}
        />
      ) : null}

      {pendingContact ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: 10,
            borderRadius: RADII.field,
            backgroundColor: theme.surfaceAlt,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <Avatar name={pendingContact.name} photoUri={pendingContact.avatar} size={30} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{ fontSize: 12.5, fontWeight: '700', color: theme.textPrimary }}
            >
              {pendingContact.name}
            </Text>
            {pendingContact.phone ? (
              <Text style={{ fontSize: 10.5, color: theme.textTertiary }}>
                {pendingContact.phone}
              </Text>
            ) : null}
          </View>
          <IconButton
            icon={X}
            accessibilityLabel={t('debtModal.unlink')}
            size={28}
            iconSize={13}
            onPress={() => setPendingContact(null)}
          />
        </View>
      ) : null}

      {resolution?.kind === 'ambiguous' && suggestions.length === 0 ? (
        <>
          <Text style={{ fontSize: 11.5, fontWeight: '600', color: SEMANTIC.warning }}>
            {t('debtModal.ambiguousHint', {
              count: resolution.candidates.length,
              name: values.name.trim(),
            })}
          </Text>
          <PeopleList
            people={resolution.candidates}
            describe={disambiguator}
            onPick={(person) => bindPerson(person, false)}
          />
          <SecondaryButton
            variant="link"
            icon={UserPlus}
            label={t('debtModal.createNewPerson')}
            onPress={() => setForceNewPerson(true)}
          />
        </>
      ) : null}

      {resolution?.kind === 'new' ? (
        <Text style={{ fontSize: 11, color: theme.textTertiary }}>
          {t('debtModal.newPersonHint')}
        </Text>
      ) : null}

      {!pendingContact ? (
        <SecondaryButton
          icon={Users}
          label={t('debtModal.importContact')}
          onPress={() => setContactsPickerOpen(true)}
        />
      ) : null}
    </View>
  );

  return (
    <>
      <GlassModal
        visible={visible}
        onClose={handleClose}
        title={editingDebt ? t('debtModal.editTitle') : t('debtModal.createTitle')}
      >
        {notice ? (
          <InlineBanner
            kind={notice.kind}
            message={notice.message}
            onDismiss={() => setNotice(null)}
            autoDismissMs={notice.kind === 'error' ? 4000 : undefined}
          />
        ) : null}

        {personBlock}

        {/* "I owe" vs "Owed to me" drives every other field's tint and the
            installment panel — the single most consequential choice in this
            form, so it gets the large SegmentedControl. */}
        <SegmentedControl<'negative' | 'positive'>
          size="large"
          options={[
            {
              label: t('debts.type.negative'),
              value: 'negative',
              icon: TrendingDown,
              tint: SEMANTIC.negative,
            },
            {
              label: t('debts.type.positive'),
              value: 'positive',
              icon: TrendingUp,
              tint: SEMANTIC.positive,
            },
          ]}
          value={values.type}
          onChange={(type) => setValue('type', type)}
        />

        <AmountInput
          label={t('debtModal.amountLabel')}
          value={values.amount}
          onChangeValue={(v) => setValue('amount', v)}
          currencyCode={values.currency}
          onPressCurrency={() => setCurrencyPickerOpen(true)}
          tint={values.type}
        />
        <CustomSelect
          value={values.currency}
          options={currencyOptions}
          onChange={(v) => {
            setValue('currency', v);
            recordCurrencyUsage(v);
          }}
          searchable
          searchPlaceholder={t('settings.baseCurrency')}
          sheetTitle={t('settings.baseCurrency')}
          open={currencyPickerOpen}
          onOpenChange={setCurrencyPickerOpen}
          hideTrigger
        />

        <FormField label={t('debtModal.dateLabel')}>
          <TextField
            value={values.date}
            onChangeText={(v) => setValue('date', v)}
            placeholder="YYYY-MM-DD"
          />
        </FormField>

        <FormField label={t('debtModal.notesLabel')}>
          <TextField
            value={values.notes}
            onChangeText={(v) => setValue('notes', v)}
            placeholder={t('debtModal.notesPlaceholder')}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={{ minHeight: 70 }}
          />
        </FormField>

        {/* Resizes as the installment panel toggles — layout animates it
            instead of the fields below jumping. */}
        <Animated.View layout={LinearTransition.duration(220)} style={{ gap: 14 }}>
          {values.type === 'negative' ? (
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

              <FormField label={t('debtModal.monthlyPaymentLabel')}>
                <TextField
                  value={values.monthlyPayment}
                  onChangeText={(v) => setValue('monthlyPayment', v)}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                />
              </FormField>

              {showInstallmentPanel ? (
                <Animated.View
                  entering={FadeIn.duration(180)}
                  exiting={FadeOut.duration(120)}
                  style={{ flexDirection: 'row', gap: 10 }}
                >
                  <View style={{ flex: 1 }}>
                    <FormField label={t('debtModal.startDateLabel')}>
                      <TextField
                        value={values.startDate}
                        onChangeText={(v) => setValue('startDate', v)}
                        placeholder="YYYY-MM-DD"
                      />
                    </FormField>
                  </View>
                  <View style={{ flex: 1 }}>
                    <FormField label={t('debtModal.endDateLabel')}>
                      <TextField
                        value={values.endDate}
                        onChangeText={(v) => setValue('endDate', v)}
                        placeholder="YYYY-MM-DD"
                      />
                    </FormField>
                  </View>
                </Animated.View>
              ) : null}
            </View>
          ) : null}

          {!editingDebt ? (
            <StagedAttachmentsField
              staged={staged}
              setStaged={setStaged}
              onError={(message) => setNotice({ kind: 'error', message })}
            />
          ) : null}

          <GradientButton
            label={editingDebt ? t('debtModal.saveButton') : t('debtModal.createButton')}
            onPress={handleSubmit(onValid, onInvalid)}
          />

          {editingDebt && onRequestDelete ? (
            <SecondaryButton
              variant="link"
              icon={Trash2}
              color={SEMANTIC.negative}
              label={t('debtModal.deleteButton')}
              onPress={onRequestDelete}
            />
          ) : null}
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

function PersonCard({
  person,
  caption,
  trailing,
  footer,
}: {
  person: Person;
  caption?: string;
  trailing?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { theme } = useTheme();
  const details = [person.phone, person.email, person.company].filter(Boolean).join(' · ');

  return (
    <View
      style={{
        gap: 6,
        padding: 10,
        borderRadius: RADII.field,
        backgroundColor: theme.surfaceAlt,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar name={person.name} photoUri={avatarDisplayUri(person.avatar)} size={34} />
        <View style={{ flex: 1, minWidth: 0 }}>
          {caption ? (
            <Text style={{ fontSize: 10, fontWeight: '700', color: theme.accent2 }}>{caption}</Text>
          ) : null}
          <Text
            numberOfLines={1}
            style={{ fontSize: 13, fontWeight: '700', color: theme.textPrimary }}
          >
            {person.name}
          </Text>
          {details ? (
            <Text numberOfLines={1} style={{ fontSize: 10.5, color: theme.textTertiary }}>
              {details}
            </Text>
          ) : null}
        </View>
        {trailing}
      </View>
      {footer}
    </View>
  );
}

/** A short pickable list of people (suggestions, same-name candidates) — always a handful, so plain rows. */
function PeopleList({
  people,
  describe,
  onPick,
}: {
  people: Person[];
  describe: (person: Person) => string;
  onPick: (person: Person) => void;
}) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        borderRadius: RADII.field,
        borderWidth: 1,
        borderColor: theme.border,
        overflow: 'hidden',
      }}
    >
      {people.map((person, index) => (
        <ListRow
          key={person.id}
          onPress={() => onPick(person)}
          showBottomBorder={index < people.length - 1}
          leading={
            <Avatar name={person.name} photoUri={avatarDisplayUri(person.avatar)} size={28} />
          }
          title={person.name}
          subtitle={describe(person)}
        />
      ))}
    </View>
  );
}
