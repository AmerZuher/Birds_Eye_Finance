import type { NewPerson, Person } from '@/db/schema';
import { normalizePhone } from '@/utils/whatsapp';

/**
 * Person identity (FEATURE_SPEC 1.3, DEBTS_V2_PLAN §3). A person is chosen in
 * the UI whenever possible; this module is what finds one when nobody picked —
 * a typed name that was never bound, a backup restore, an AI-prompt import.
 * Resolution order: device contactId → phone → exactly one normalized-name
 * match → otherwise a new person. Names are never identity on their own, and
 * there is deliberately no fuzzy matching: an auto-merge nobody noticed is
 * worse than a duplicate that can be merged.
 */

const ARABIC_DIACRITICS = /[ً-ْٰ]/g;
const TATWEEL = /ـ/g;
const ALEF_VARIANTS = /[آأإٱ]/g;
const ARABIC_INDIC_DIGITS = /[٠-٩]/g;
const PERSIAN_DIGITS = /[۰-۹]/g;

/**
 * Matching key for a name: trimmed, inner whitespace collapsed, case-folded,
 * Arabic diacritics/tatweel removed, أ/إ/آ/ٱ → ا, ى → ي, ة → ه. Only ever used
 * for suggestions and matching — the name itself is displayed as entered.
 */
export function toNameKey(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(ARABIC_DIACRITICS, '')
    .replace(TATWEEL, '')
    .replace(ALEF_VARIANTS, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

function toAsciiDigits(value: string): string {
  return value
    .replace(ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(PERSIAN_DIGITS, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** Matching key for a phone: the WhatsApp normalization (FEATURE_SPEC 1.6), digits only. */
export function toPhoneKey(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const key = normalizePhone(toAsciiDigits(phone)).replace(/\D/g, '');
  return key.length > 0 ? key : null;
}

export interface PersonFields {
  name: string;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  avatar?: string | null;
  contactId?: string | null;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Column values for a person row, with both matching keys derived — the only way person rows get written. */
export function toPersonValues(fields: PersonFields): Omit<NewPerson, 'id' | 'createdAt'> {
  const name = fields.name.trim();
  const phone = clean(fields.phone);
  return {
    name,
    nameKey: toNameKey(name),
    phone,
    phoneKey: toPhoneKey(phone),
    email: clean(fields.email),
    company: clean(fields.company),
    avatar: clean(fields.avatar),
    contactId: clean(fields.contactId),
  };
}

export type PersonResolution =
  | { kind: 'existing'; person: Person; matchedBy: 'contact' | 'phone' | 'name' }
  | { kind: 'ambiguous'; candidates: Person[] }
  | { kind: 'new' };

export interface ResolveOptions {
  /** The user explicitly asked for a new person. Strong keys still apply, so a
   * new person can never collide with an existing phone or contact. */
  skipNameMatch?: boolean;
}

export function findByName(name: string, people: Person[]): Person[] {
  const key = toNameKey(name);
  if (!key) return [];
  return people.filter((person) => person.nameKey === key);
}

export function resolvePerson(
  input: { name: string; phone?: string | null; contactId?: string | null },
  people: Person[],
  options: ResolveOptions = {},
): PersonResolution {
  const contactId = clean(input.contactId);
  if (contactId) {
    const byContact = people.find((person) => person.contactId === contactId);
    if (byContact) return { kind: 'existing', person: byContact, matchedBy: 'contact' };
  }

  const phoneKey = toPhoneKey(input.phone);
  if (phoneKey) {
    const byPhone = people.find((person) => person.phoneKey === phoneKey);
    if (byPhone) return { kind: 'existing', person: byPhone, matchedBy: 'phone' };
  }

  if (options.skipNameMatch) return { kind: 'new' };

  // With a phone in hand, a same-name person who already has a *different*
  // phone is a different person — only phone-less namesakes stay candidates.
  const byName = findByName(input.name, people).filter((person) => !phoneKey || !person.phoneKey);
  if (byName.length === 1) return { kind: 'existing', person: byName[0], matchedBy: 'name' };
  if (byName.length > 1) return { kind: 'ambiguous', candidates: byName };
  return { kind: 'new' };
}

/** Live suggestions for a typed name (or number): prefix matches first, then substring matches. */
export function suggestPeople(query: string, people: Person[], limit = 6): Person[] {
  const key = toNameKey(query);
  if (!key) return [];
  const digits = toAsciiDigits(query).replace(/\D/g, '');
  const prefix: Person[] = [];
  const rest: Person[] = [];
  for (const person of people) {
    if (person.nameKey.startsWith(key)) prefix.push(person);
    else if (person.nameKey.includes(key)) rest.push(person);
    else if (digits.length >= 3 && person.phoneKey?.includes(digits)) rest.push(person);
  }
  return [...prefix, ...rest].slice(0, limit);
}

/** "•••4567" — enough of a phone to tell two same-name people apart without showing it all. */
export function phoneTail(phone: string | null | undefined): string | null {
  const key = toPhoneKey(phone);
  return key ? `•••${key.slice(-4)}` : null;
}
