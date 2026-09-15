# BirdsEye Finance — Debts v2 + Global UX Plan

Status: **approved and implemented 2026-09-15** (`PHASES.md` Phase 6) — typecheck/lint clean, **not yet verified on a device**.
Sections below describe what was built; where the build deviated from the original plan, the text says so.
Screen behavior lives in `FEATURE_SPEC.md` (0.9 and Part 1, already rewritten to the target behavior).
This doc holds the technical design and the reasoning. Build order and done-state live in `PHASES.md` Phase 6.

---

## 0. Decisions log

| # | Decision | Status |
|---|----------|--------|
| 1 | `SEMANTIC.warning` (`#fbbf24`, the amber already in use) added to `theme.ts`; `withAlpha()` added to `src/utils/color.ts`; `InlineBanner` + `Expenses` moved onto tokens. CLAUDE.md rule 3 extended: no hardcoded visual values, no restyled copies of primitives. | **Done** 2026-09-15 (user sign-off) |
| 2 | Money comparisons use a 0.005 tolerance on the existing `real` columns — no integer-cents migration. | Accepted (user asked for the recommended option) |
| 3 | "Settle all" for people whose net is zero but who still have active debts (FEATURE_SPEC 1.9). | Accepted |
| 4 | FEATURE_SPEC updated before building. | Accepted — **done** |
| 5 | "Main dashboard" in the request = the Debts summary list. Dashboard stays a placeholder (rule 15). | Accepted |
| 6 | Person identity is chosen in the UI and otherwise resolved by contactId → phone → exactly-one normalized-name match (§3). | Accepted |

Side effect of decision 1, not yet checked on a device: InlineBanner's success/error colors were stale copies of an
older palette (`#34d399` / `#fb7185`). They now read `SEMANTIC.positive` / `SEMANTIC.negative` (`#10b981` / `#f43f5e`),
so success and error banners are a slightly deeper green and red.

---

## 1. Hidden scrollbars (FEATURE_SPEC 0.9)

- Every `ScrollView` already hides its indicator. The visible bars come from lists that never set the prop:
  `Debts.tsx` (3× `FlashList`), `Expenses.tsx`, `ContactsPicker.tsx` (`FlashList`), `CustomSelect.tsx` (`FlatList`).
- Add `src/lib/scroll.ts`:
  `export const HIDDEN_SCROLLBARS = { showsVerticalScrollIndicator: false, showsHorizontalScrollIndicator: false } as const;`
  and spread it on every scroll container, existing and new.
- Web only (if the web build ships): `scrollbar-width: none` + `::-webkit-scrollbar { display: none }` in `global.css`.

## 2. Keyboard handling (FEATURE_SPEC 0.9)

**Root cause.** `GlassModal.tsx` passes `behavior={undefined}` to `KeyboardAvoidingView` on Android, so it does
nothing there. `android/gradle.properties` has `edgeToEdgeEnabled=true`, and under edge-to-edge `adjustResize` no
longer shrinks the window. The sheet is rendered in the root view through `ModalPortalContext`, so nothing moves.
`EditProfileScreen` and `DataScreen` have no keyboard handling at all.

**Fix (as built).**
- `react-native-keyboard-controller` 1.21.9 (the SDK 57 version, via `npx expo install`). Native module → dev-client
  rebuild; not Expo Go. `<KeyboardProvider statusBarTranslucent navigationBarTranslucent>` in `app/_layout.tsx`.
- `GlassModal` no longer uses `KeyboardAvoidingView`. The sheet lifts itself: an animated `marginBottom` equal to the
  live keyboard height (`useReanimatedKeyboardAnimation`), and `maxHeight` = 96% of the container minus that height, so
  the sheet and its scroll viewport always sit above the keyboard.
- Focused field: measured with `TextInput.State.currentlyFocusedInput().measureLayout(...)` against the sheet
  ScrollView's inner view, then scrolled to keep a 24px margin. Triggered on `useKeyboardHandler`'s `onEnd` and when
  the focused input changes while the keyboard stays open (watched via `useReanimatedFocusedInput().input.target`).
  *Deviation:* the plan read the focused input's layout from `useReanimatedFocusedInput()` directly — that layout is
  window-relative and goes stale as the sheet lifts, so it's only used to notice focus changes.
  **No** `KeyboardAwareScrollView` inside the lifted sheet — both would compensate for the same keyboard.
- `EditProfileScreen`, `DataScreen`: `KeyboardAwareScrollView` (`bottomOffset={24}`).
- Lists with a search field (Debts summary, Expenses, `ContactsPicker`, `CustomSelect`, person picker):
  `keyboardShouldPersistTaps="handled"`, `keyboardDismissMode="on-drag"`.
- Verify on the dev build, Android (edge-to-edge) and iOS: the last field of DebtModal, CustomSelect's search, and
  the bottom field of Edit Profile.

---

## 3. People & identity

### 3.1 Why a `people` table
Today `groupedDebts` groups by trimmed name text and copies phone/email/company onto every debt row. That causes three
problems. A typo ("Ahmad" vs "Ahmed") splits one person into two. Two different people named Ahmed merge into one.
And contact details live in N copies. Removing the contact fields from DebtModal requires one place for them to live.

### 3.2 Schema (`src/db/schema.ts`)

```ts
export const people = sqliteTable(
  'people',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),            // displayed exactly as entered
    nameKey: text('name_key').notNull(),     // normalized, for matching/suggestions only
    phone: text('phone'),                    // displayed as entered
    phoneKey: text('phone_key'),             // normalizePhone(phone), null when no phone
    email: text('email'),
    company: text('company'),
    avatar: text('avatar'),
    contactId: text('contact_id'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('people_name_key_idx').on(t.nameKey),           // NOT unique — names repeat
    uniqueIndex('people_phone_key_uq').on(t.phoneKey),     // SQLite allows many NULLs in a unique index
    uniqueIndex('people_contact_id_uq').on(t.contactId),
  ],
);

// debts: + personId: integer('person_id').references(() => people.id)
```

`debts.name` stays for now and is written as a snapshot of the person's name, because it is `NOT NULL` and old backups
rely on it. `debts.phone/email/company/avatar/contactId` are no longer read or written. All of these are dropped in a
later cleanup migration (§3.7).

### 3.3 Normalization (`src/lib/people.ts`)
- `toNameKey(name)`: trim → collapse inner whitespace → lowercase → strip Arabic diacritics (U+064B–U+0652) and
  tatweel (U+0640) → `أ إ آ ٱ` → `ا`, `ى` → `ي`, `ة` → `ه`. This way "أحمد", "احمد" and "Ahmed " / "ahmed" each
  collapse to one key per script.
- `toPhoneKey(phone)`: `normalizePhone()` from `src/utils/whatsapp.ts` (the one normalization rule in the app);
  empty → `null`.

### 3.4 Resolver
One pure function, shared by DebtModal, Edit Person, backup restore and AI-prompt import:

```ts
type Resolution =
  | { kind: 'existing'; person: Person }
  | { kind: 'ambiguous'; candidates: Person[] }   // DebtModal only — user must pick
  | { kind: 'new' };

function resolvePerson(input: { name: string; phone?: string; contactId?: string }, people: Person[]): Resolution
// 1. contactId matches a person            → existing
// 2. phoneKey matches a person             → existing
// 3. nameKey matches:
//      exactly 1 → existing, UNLESS input has a phone and that person has a different phoneKey → new
//      2 or more → ambiguous (imports treat this as new)
//      0         → new
```

The database indexes back this up: a second person can never get the same phone or contactId, even through a bug.

### 3.5 How "add another debt for Ahmed" plays out

| Situation | What happens | New person created? |
|---|---|---|
| FAB pressed on Ahmed's page | DebtModal opens with Ahmed's card locked (`personId` prefilled). | No |
| FAB elsewhere, type "Ahm", tap the "Ahmed · •••4567" suggestion | Bound by `personId`. | No |
| Type "Ahmed" (or "احمد" for "أحمد"), don't tap anything, one Ahmed exists | Auto-bound; card says "Adding to Ahmed" + "Not this person? Create new". | No (unless user taps Create new) |
| Type "Ahmed", two Ahmeds exist | Save blocked; both listed with phone/company to pick from, plus "Create new person". | Only if user chooses it |
| Type "Ahmed", import a contact whose phone is already Ahmed Ali's | "This number belongs to Ahmed Ali" → bound to him. | No |
| Type "Ahmad" (spelling differs), no phone | Treated as new — no fuzzy matching. The suggestion list while typing "Ahm" is the guard; Merge (§3.6) is the fix. | Yes |

The table's rule: saving writes only a `personId`. A new person is created only when no match exists, or when the user
explicitly asks for one. Fuzzy name matching is deliberately left out — an auto-merge you didn't notice is worse than a
duplicate you can merge.

### 3.6 Repair tools
- **Merge into…** (Edit Person): in one `db.transaction`, reassign all debts to the target, fill the target's empty
  contact fields from the source, delete the source.
- **Move to another person** (debt detail sheet): update `debts.personId`.

### 3.7 Migration
1. `npm run db:generate` → `people` table, indexes, `debts.person_id`.
2. **Backfill in TypeScript, not SQL** — the Arabic normalization and `normalizePhone` can't be expressed in SQLite.
   Add `backfillPeople()`, run from `FinanceContext` after `useMigrations` succeeds, whenever any debt has
   `person_id IS NULL`. That condition is the guard: the function is idempotent and needs no MMKV flag. Inside one
   `db.transaction`:
   - Group debts by `trim(name)` exactly as the current engine does, so the groups users see don't change.
   - Create one person per group, taking the newest non-empty phone/email/company/avatar/contactId — today's
     "first found, newest-first" merge rule.
   - If two name groups share a phone or contactId, merge them into one person (the phone is the strong key); the name
     comes from the newest debt.
   - Set `debts.person_id`.
3. Enable foreign keys: `sqliteDb.execSync('PRAGMA foreign_keys = ON')` in `src/db/client.ts`. SQLite leaves them off
   per connection, so every `onDelete: 'cascade'` below would otherwise silently do nothing.
4. A later cleanup migration drops the legacy debt contact columns once §7's import mapping ships. Risk to check then:
   drizzle-kit rebuilds the table to drop columns, and `PRAGMA foreign_keys` is a no-op inside a transaction, so verify
   the rebuild with foreign keys enabled.

---

## 4. Adjustments, status, archiving

### 4.1 Schema
```ts
export const debtAdjustments = sqliteTable('debt_adjustments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  debtId: integer('debt_id').notNull().references(() => debts.id, { onDelete: 'cascade' }),
  amount: real('amount').notNull(),        // signed; always in the parent debt's currency
  date: text('date').notNull(),            // YYYY-MM-DD, local calendar (same rule as DebtModal)
  note: text('note'),
  createdAt: text('created_at').notNull(),
});
```

### 4.2 Derived status (`src/lib/debtStatus.ts`)
Status is never stored — a stored `archived`/`status` column can fall out of sync with the ledger.

```ts
export const MONEY_EPSILON = 0.005;
export type DebtStatus = 'open' | 'partial' | 'settled';

export function getDebtStatus(amount: number, adjustmentSum: number) {
  const outstanding = amount + adjustmentSum;
  const status: DebtStatus =
    outstanding <= MONEY_EPSILON ? 'settled' : adjustmentSum < -MONEY_EPSILON ? 'partial' : 'open';
  return { outstanding: Math.max(outstanding, 0), paid: Math.max(-adjustmentSum, 0), status };
}
```

- Settled date = latest `date` among the debt's adjustments. This stays correct after a reopen and a later re-settle.
- Debt ID label: `#${String(id).padStart(4, '0')}`. IDs are stable because the table uses `AUTOINCREMENT`, so SQLite
  never reuses one.

### 4.3 Rules
- A − adjustment can't exceed outstanding (no overpayment). Editing a debt's amount can't drop below `paid`.
- A + adjustment on a settled debt reopens it — nothing to do, status is derived.
- **Settle all:** for a person with net exactly 0 (within epsilon) and active debts, one `db.transaction` inserts a
  closing adjustment of `-outstanding` on each active debt.
- **Totals change:** net balance, per-person net and `totalNegativeMonthly` switch from `amount` over non-deleted debts
  to `outstanding` over active debts. Rule 14 still holds — installments stay on Debt. Settled installment plans stop
  reducing effective income. This is intended, but it visibly changes numbers users already have.

---

## 5. Attachments

### 5.1 Schema
```ts
export const debtAttachments = sqliteTable('debt_attachments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  debtId: integer('debt_id').notNull().references(() => debts.id, { onDelete: 'cascade' }),
  adjustmentId: integer('adjustment_id').references(() => debtAdjustments.id, { onDelete: 'set null' }),
  fileName: text('file_name').notNull(),   // relative: "<uuid>.<ext>" — never an absolute URI
  mimeType: text('mime_type').notNull(),
  originalName: text('original_name'),
  sizeBytes: integer('size_bytes').notNull(),
  createdAt: text('created_at').notNull(),
});
```

### 5.2 Storage (`src/lib/attachments.ts`, `expo-file-system` `File`/`Directory`/`Paths`)
- Files go under `Paths.document/attachments/<uuid>.<ext>` — **flat**. *Deviation from the original plan*
  (`attachments/<debtId>/…`): debt ids are remapped on backup restore, so a folder named after an id could end up
  holding another debt's files, and deleting "debt 5's folder" would delete them. File names carry no id at all.
- Store only the relative `fileName` and resolve the full URI at render time: on iOS the app container's absolute path
  can change across updates. (`EditProfileScreen.tsx` still stores the profile avatar as an absolute `Paths.document`
  URI — same latent problem, not changed in this phase.) Person photos picked in Edit Person use the same rule, via an
  `app-avatar:<file>` value in `people.avatar` (`src/lib/avatars.ts`).
- Picked files are staged in `Paths.cache/attachments-staging/` immediately (images downscaled, PDFs size-checked),
  then committed into permanent storage right before their row is inserted.
- **Sources** (all already installed): `expo-image-picker` for camera and library, `expo-document-picker` for PDF.
- **Images:** `expo-image-manipulator`, long edge capped at 2000px, JPEG quality 0.85.
- **PDFs:** stored as-is; files over 15 MB are rejected.
- **Write order:** commit the file → insert the row. If the insert fails, delete the file.
- **`move`/`copy` are async** in expo-file-system SDK 57 (`moveSync`/`copySync` block). Always await them — a row
  written before its file lands points at nothing. `delete`/`create`/`write`/`exists`/`list` are synchronous.
- **Delete order:** delete the row → delete the file. `permanentlyDeleteDebt` deletes each of the debt's files by row
  (rows cascade in SQL; files don't). Soft delete keeps everything.
- **Launch reconcile** (`reconcileAttachmentFiles`, run by `DatabaseProvider`): clears staging, deletes files no row
  refers to, drops rows whose file is missing.
- **Staging in DebtModal/AdjustmentSheet:** staged files are discarded when the form closes without saving.
- **Viewing:** images in a `GlassModal` viewer with pinch-zoom, drag while zoomed, double-tap reset. PDFs via
  `expo-sharing` `shareAsync(uri, { mimeType, UTI: 'com.adobe.pdf' })`.
- **`app.json`:** `expo-image-picker` `photosPermission` reworded to cover attachments; `cameraPermission` added.
  Needs a prebuild to reach the native projects.

---

## 6. State management

- **Split `FinanceContext`** into `DebtsContext` (people, debts, adjustment sums, `groupedDebts`, debt totals, all debt,
  person and adjustment writes) and `FinanceContext` (income, expenses, savings math — it reads `totalNegativeMonthly`
  from `DebtsContext`). Today one memoized value covers everything, so every expense edit re-renders every debt
  consumer, and this work would take the file past ~450 lines.
- **Always-on live queries:**
  - `people`
  - `debts` (active + deleted, as today)
  - one adjustment aggregate: `select debtId, sum(amount), max(date) from debt_adjustments group by debtId`, turned
    into a `Map` in `useMemo`
- **Scoped live queries**, mounted only while the debt detail sheet is open: `debt_adjustments where debtId = ?` and
  `debt_attachments where debtId = ?`.
- **Caveat:** drizzle's `useLiveQuery` re-runs only when the table in its `from()` changes — changes to joined tables
  don't trigger it. Keep one live query per table and combine them in `useMemo`, never a join.
- Every multi-row write (new person + debt, Settle all, Merge, adjustment + its attachment rows) goes through one
  `db.transaction`.
- **Pure logic** lives in `src/lib/` — `people.ts`, `debtStatus.ts`, `attachments.ts`, `scroll.ts` — so screens don't
  hold rules.
- **Forms:** DebtModal, Edit Person and the adjustment sheet all use react-hook-form + zod, with errors in InlineBanner.
- **Lists:** the adjustment ledger and both History tabs use `FlashList` (rule 6). Inside a sheet, use
  `GlassModal scrollable={false}` with the list's `ListHeaderComponent` carrying the rest of the content — the same
  pattern `CustomSelect` uses.
- Screen-only UI state (History segment, which sheet is open, staged files) stays local `useState` in the screen or
  modal.

---

## 7. Backups & imports

- `src/utils/autoBackup.ts` — since 2.1.0 `src/utils/dataTransfer.ts`, export/import only; the MMKV auto-backup
  and Restore were removed — snapshots whole tables. Add `people`, `debtAdjustments` and `debtAttachments`
  (metadata only). Files are not part of an export, and the Data screen must say so. On import, drop attachment
  rows whose file doesn't exist.
- **Import must remap IDs** because autoincrement assigns new ones. Order: people (old→new id map) → debts
  (remap `personId`, build a debt id map) → adjustments (remap `debtId`) → attachments (remap `debtId`/`adjustmentId`).
- **Old-shape backups and AI-prompt imports** (`src/prompts/debtsPrompt.ts` still emits `phone/email/company` per
  debt — keep it, rule 1's exception is unchanged): run each row through `resolvePerson({ name, phone, contactId })`,
  create or bind the person, fill the person's empty fields from the row, then insert the debt with `personId`.

---

## 8. Token & primitive cleanup (CLAUDE.md rule 3)

**Done in 6E.** Every color literal outside `theme.ts`/`brandIcons.ts` was replaced with `theme.*` / `SEMANTIC.*` /
`withAlpha()` — Avatar rings, IconButton, ListRow (now `getThemeGlass(theme).surfaceWash`), SecondaryButton, Badge,
ConfirmModal, ToggleSwitch, Navbar, BalanceRevealCard, RiyalSymbol, AmountInput's and ExpenseModal's hex-alpha
suffixes, Debts' tiles, and About's repo-button wash. Several were stale copies of the old semantic colors
(`#34d399`/`#fb7185`), so those spots now show the current, slightly deeper green/red. Non-circle one-off radii in the
primitives moved to `RADII`. Hand-built pills/buttons/rows in Debts and DataScreen now use `Badge`/`FilterChip`,
`SecondaryButton` (incl. its new `link` variant) and `ListRow`; ExpenseModal and the new sheets share
`src/components/FormField.tsx` instead of per-form copies.

**Enforcement:** ESLint `no-restricted-syntax` (`eslint.config.js`) flags hex literals, numeric `rgb(a)(` strings and
templates, and hex-alpha suffixes like `` `${color}55` ``. It's at `error`.

**Resolved 2026-09-16 (user sign-off), with About's look kept exactly as it was:** its support-button colors moved
into `theme.ts` as `SUPPORT_TINTS` (the same pink/blue values, on every theme); its hand-built `SupportButton` and repo
button became `SecondaryButton variant="pill"` — accent, tinted and neutral tones that reproduce the old pills
value-for-value (radius, padding, gap, font and icon sizes, wash/border alphas), with new `leading`/`trailingIcon`
slots for the repo button; the logo glow's `borderRadius: 25` became the new `RADII.logoTile` (25). No violations remain.

---

## 9. Build order
See `PHASES.md` → Phase 6 (6A–6E). 6A and 6D must be verified on an EAS/dev-client build, not Expo Go.
