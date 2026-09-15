import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useForm } from 'react-hook-form';
import type { SubmitErrorHandler, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as ImagePicker from 'expo-image-picker';
import { Camera, GitMerge, Users, X } from 'lucide-react-native';

import { ContactsPicker } from '@/components/ContactsPicker';
import type { PickedContact } from '@/components/ContactsPicker';
import { FormField, TextField } from '@/components/FormField';
import { PersonPickerSheet } from '@/components/PersonPickerSheet';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { GlassModal } from '@/components/ui/GlassModal';
import { GradientButton } from '@/components/ui/GradientButton';
import { InlineBanner } from '@/components/ui/InlineBanner';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { PersonConflictError, useDebts } from '@/context/DebtsContext';
import { useLanguage } from '@/context/LanguageContext';
import type { Person } from '@/db/schema';
import { avatarDisplayUri, deleteStoredAvatar, savePersonAvatar } from '@/lib/avatars';

export type PersonDetailField = 'phone' | 'email' | 'company';

const formSchema = z.object({
  name: z.string().refine((value) => value.trim().length > 0, { message: 'name' }),
  phone: z.string(),
  email: z.string().refine((value) => !value.trim() || z.email().safeParse(value.trim()).success, {
    message: 'email',
  }),
  company: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

const EMPTY_VALUES: FormValues = { name: '', phone: '', email: '', company: '' };

interface EditPersonSheetProps {
  visible: boolean;
  onClose: () => void;
  person: Person | null;
  /** Which detail field to focus on open — set by the person page's dashed "+ Add …" chips. */
  focusField?: PersonDetailField | null;
  /** Called after this person was merged into another; the caller shows the survivor. */
  onMerged: (targetPersonId: number) => void;
}

/**
 * Edit a person's own details (FEATURE_SPEC 1.11) — contact details live
 * here, not in DebtModal. A phone or device contact that already belongs to
 * someone else is rejected (identity rules, 1.3), with a one-tap merge offered
 * instead. react-hook-form + zod with InlineBanner errors, same as DebtModal.
 */
export function EditPersonSheet({
  visible,
  onClose,
  person,
  focusField,
  onMerged,
}: EditPersonSheetProps) {
  const { t } = useLanguage();
  const { updatePerson, mergePeople, peopleById } = useDebts();

  const { watch, setValue, reset, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY_VALUES,
  });
  const values = watch();

  const [avatar, setAvatar] = useState<string | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState<Person | null>(null);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [mergePickerOpen, setMergePickerOpen] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<Person | null>(null);
  // Photos this sheet saved during the current edit — whichever isn't kept
  // (cancelled, or replaced by another pick) is deleted again.
  const createdAvatars = useRef<string[]>([]);

  useEffect(() => {
    if (!visible || !person) return;
    reset({
      name: person.name,
      phone: person.phone ?? '',
      email: person.email ?? '',
      company: person.company ?? '',
    });
    setAvatar(person.avatar);
    setContactId(person.contactId);
    setError('');
    setConflict(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, person?.id]);

  const discardUnusedAvatars = (kept: string | null) => {
    for (const stored of createdAvatars.current) {
      if (stored !== kept) deleteStoredAvatar(stored);
    }
    createdAvatars.current = [];
  };

  const close = () => {
    discardUnusedAvatars(person?.avatar ?? null);
    onClose();
  };

  const pickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      if (result.canceled) return;
      const stored = await savePersonAvatar(result.assets[0].uri);
      createdAvatars.current.push(stored);
      setAvatar(stored);
    } catch {
      setError(t('editPerson.error.photo'));
    }
  };

  const handleContact = (contact: PickedContact) => {
    setContactsOpen(false);
    if (contact.phone) setValue('phone', contact.phone);
    if (contact.email) setValue('email', contact.email);
    if (contact.company) setValue('company', contact.company);
    if (contact.avatar) setAvatar(contact.avatar);
    if (!values.name.trim()) setValue('name', contact.name);
    setContactId(contact.contactId);
    setConflict(null);
    setError('');
  };

  const onValid: SubmitHandler<FormValues> = (submitted) => {
    if (!person) return;
    try {
      updatePerson(person.id, {
        name: submitted.name,
        phone: submitted.phone,
        email: submitted.email,
        company: submitted.company,
        avatar,
        contactId,
      });
    } catch (caught) {
      if (caught instanceof PersonConflictError) {
        setConflict(caught.conflict);
        setError(t('editPerson.error.phoneTaken', { name: caught.conflict.name }));
      } else {
        setError(t('debtModal.error.save'));
      }
      return;
    }
    if (person.avatar !== avatar) deleteStoredAvatar(person.avatar);
    discardUnusedAvatars(avatar);
    onClose();
  };

  const onInvalid: SubmitErrorHandler<FormValues> = (errors) => {
    setError(errors.name ? t('editPerson.error.name') : t('editPerson.error.email'));
  };

  const confirmMerge = () => {
    if (!person || !mergeTarget) return;
    const target = peopleById.get(mergeTarget.id);
    mergePeople(person.id, mergeTarget.id);
    // The survivor keeps its own photo when it has one — this person's stored
    // photo would then be referenced by nobody.
    if (target?.avatar && person.avatar) deleteStoredAvatar(person.avatar);
    discardUnusedAvatars(null);
    const targetId = mergeTarget.id;
    setMergeTarget(null);
    onClose();
    onMerged(targetId);
  };

  return (
    <>
      <GlassModal visible={visible} onClose={close} title={t('editPerson.title')}>
        {error ? (
          <InlineBanner kind="error" message={error} onDismiss={() => setError('')} />
        ) : null}
        {conflict ? (
          <SecondaryButton
            icon={GitMerge}
            label={t('editPerson.mergeWith', { name: conflict.name })}
            onPress={() => setMergeTarget(conflict)}
          />
        ) : null}

        <View style={{ alignItems: 'center', gap: 6 }}>
          <Pressable
            onPress={() => void pickPhoto()}
            accessibilityRole="button"
            accessibilityLabel={t('editPerson.changePhoto')}
          >
            <Avatar
              name={values.name || person?.name}
              photoUri={avatarDisplayUri(avatar)}
              size={72}
              ring="accent"
            />
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <SecondaryButton
              variant="link"
              icon={Camera}
              label={t('editPerson.changePhoto')}
              onPress={() => void pickPhoto()}
            />
            {avatar ? (
              <SecondaryButton
                variant="link"
                icon={X}
                label={t('editPerson.removePhoto')}
                onPress={() => setAvatar(null)}
              />
            ) : null}
          </View>
        </View>

        <FormField label={t('editPerson.nameLabel')}>
          <TextField value={values.name} onChangeText={(v) => setValue('name', v)} />
        </FormField>
        <FormField label={t('editPerson.phoneLabel')}>
          <TextField
            value={values.phone}
            onChangeText={(v) => {
              setValue('phone', v);
              setConflict(null);
            }}
            keyboardType="phone-pad"
            autoFocus={focusField === 'phone'}
            placeholder={t('editPerson.phonePlaceholder')}
            style={{ textAlign: 'left', writingDirection: 'ltr' }}
          />
        </FormField>
        <FormField label={t('editPerson.emailLabel')}>
          <TextField
            value={values.email}
            onChangeText={(v) => setValue('email', v)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoFocus={focusField === 'email'}
            placeholder={t('editPerson.emailPlaceholder')}
            style={{ textAlign: 'left', writingDirection: 'ltr' }}
          />
        </FormField>
        <FormField label={t('editPerson.companyLabel')}>
          <TextField
            value={values.company}
            onChangeText={(v) => setValue('company', v)}
            autoFocus={focusField === 'company'}
            placeholder={t('editPerson.companyPlaceholder')}
          />
        </FormField>

        <SecondaryButton
          icon={Users}
          label={t('editPerson.reimport')}
          onPress={() => setContactsOpen(true)}
        />
        <GradientButton label={t('editPerson.save')} onPress={handleSubmit(onValid, onInvalid)} />
        <SecondaryButton
          variant="link"
          icon={GitMerge}
          label={t('editPerson.mergeInto')}
          onPress={() => setMergePickerOpen(true)}
        />
      </GlassModal>

      <ContactsPicker
        visible={contactsOpen}
        onClose={() => setContactsOpen(false)}
        onSelect={handleContact}
      />
      <PersonPickerSheet
        visible={mergePickerOpen}
        onClose={() => setMergePickerOpen(false)}
        title={t('editPerson.mergeInto')}
        excludeIds={person ? [person.id] : []}
        onSelect={(target) => {
          setMergePickerOpen(false);
          setMergeTarget(target);
        }}
      />
      <ConfirmModal
        visible={!!mergeTarget}
        title={t('editPerson.mergeTitle', {
          source: person?.name ?? '',
          target: mergeTarget?.name ?? '',
        })}
        subtitle={t('editPerson.mergeSubtitle', {
          source: person?.name ?? '',
          target: mergeTarget?.name ?? '',
        })}
        onCancel={() => setMergeTarget(null)}
        onConfirm={confirmMerge}
        confirmLabel={t('editPerson.merge')}
        cancelLabel={t('common.cancel')}
      />
    </>
  );
}
