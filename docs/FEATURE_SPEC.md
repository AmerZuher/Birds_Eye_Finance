BirdsEye Finance — Feature Documentation

Screens: Dashboard (minimal placeholder, see CLAUDE.md rule 15) · Debts · Expenses · Settings · About (stub, see CLAUDE.md rule 16)

Source files (src/ unless noted):

pages/Debts.tsx, pages/Expenses.tsx, pages/Settings.tsx
components/DebtModal.tsx, components/ExpenseModal.tsx, components/ContactsPicker.tsx, components/ui/* (the 18 shared primitives), components/Navbar.tsx, components/Header.tsx
Sub-screens: pages/EditProfileScreen.tsx, pages/DataScreen.tsx (Phase 2)
Contexts: context/FinanceContext.tsx, context/UserContext.tsx, context/CurrencyContext.tsx, context/ThemeContext.tsx
Utils/constants: utils/autoBackup.ts, constants/theme.ts, constants/brandIcons.ts, constants/initialData.ts, prompts/debtsPrompt.ts, prompts/expensesPrompt.ts

PART 0 — SHARED INFRASTRUCTURE (applies to all screens)

0.1 Screen chrome (Header + Navbar + FAB)
Header — built from the shared GlassHeader primitive. Floating glassmorphic bar pinned to top, respects safe-area insets. Left: app logo tile + "BirdsEye Finance" title → tapping navigates to About. Right: user avatar pill → tapping navigates to Settings; gets a visible accent-colored border when Settings is already active. Hidden on the Settings and About screens, which render their own header (back button + title) in the same GlassHeader slot instead.
Navbar (components/Navbar.tsx) — bottom glassmorphic tab bar with 3 items: Dashboard (Home icon), Expenses (CreditCard icon), Debts (Wallet icon). Active item takes the theme's accent color, thicker stroke, bolder label; inactive items are muted. Light haptic feedback on every tab press. Tab switching preserves state — it does not reset the Debts person-detail view, and Settings sub-screen state survives tab switches.
Floating Action Button (FAB, inside Navbar) — rendered only on the Expenses and Debts tabs, positioned clear above the navbar (not overlapping it). Background = theme fabColor, white Plus icon. On press: opens the correct GlassModal-based form (Debts tab → new debt; Expenses tab → new expense).

0.2 Android hardware-back hierarchy
Intercepted in order: a modal is open → the modal's own close handler consumes it. Settings sub-screen open → return to Settings main hub. On Settings or About → jump to previousTab (the exact tab the user came from). On Debts tab with an open person detail → return to person list. Dashboard root → back press swallowed (prevents accidental exit).

0.3 Theming
Governed entirely by the locked design tokens (CLAUDE.md rule 3: Platinum / Emerald / Obsidian / Sapphire) and the approved design preview. Theme selection persists to MMKV. Theme affects: card surfaces, category chips (active state), submit buttons, FAB, sheet borders/handles, dropdown selected checkmark, header overlays.

0.4 Language / RTL
Languages: Arabic (ar, RTL) and English (en, LTR); persists to MMKV. Every screen reads { dir, t, language }; isRTL = dir === 'rtl'. Consistent patterns used everywhere: flexDirection reverses for RTL, text alignment flips, arrow icons flip direction by language, root containers set direction for NativeWind logical properties. t(key, vars) supports {{var}} interpolation (used for the WhatsApp message, import counts, etc.).

0.5 Money handling
20 currencies defined with Arabic symbol, English symbol, code, locale, localized names, plus a static exchange-rate table with SAR as base = 1.0. No live rates — conversion formula: (amount × rateFrom) / rateBase. Base currency selection persists to MMKV. formatMoney() is locale-aware via Intl.NumberFormat (Arabic locale uses Arabic-Indic digits and "amount then symbol"; English uses "symbol then amount"). formatOriginalMoney(amount, currency) formats an amount in its original transaction currency, not the base currency. convertToBase(amount, fromCurrency) is used across screens.

0.6 Period math
getMonthlyEquivalent converts any billing period to a monthly equivalent for totals: daily ×30.44 · weekly ×4.345 · custom ×(30.44/customPeriodDays) · 3months ÷3 · 6months ÷6 · 9months ÷9 · yearly ÷12 · monthly ×1.

0.7 Persistence map
Relational data — expo-sqlite via Drizzle: expenses table, debts table, incomeSources table.
Preferences — react-native-mmkv (synchronous reads): theme id, base currency code, language, fontScale, profile blob (name, avatar, startBalances, lastReconciledDate — not relational enough to warrant a SQL table), activeTab/previousTab, settingsScreen ('main' | 'edit-profile' | 'data'), autoBackup meta ({ frequency, lastBackup }) and the autoBackup snapshot itself.

0.8 Reusable UI components
See CLAUDE.md rule 4 for the full list of 18 shared primitives and what each covers. Every screen composes these; none of them duplicate Tailwind classes or reimplement a pattern another screen already has.

PART 1 — DEBTS SCREEN (src/pages/Debts.tsx)
Two mutually-exclusive views driven by selectedPerson from FinanceContext.

1.1 Layout skeleton
Root scrollable list (FlashList per CLAUDE.md rule 6) with content padding that clears the FAB/navbar below and the glass header above. Entrance animation on mount, direction-aware.

1.2 Summary view (person list) — shown when no person is selected
Header block: page title + subtitle, hairline divider. Net base balance: label + big value = totalPositiveAmount − totalNegativeAmount (both converted to base currency), colored positive/negative by sign. **Also shown here: the aggregate monthly installment total** — sum of monthlyPayment across all negative debts with an active installment plan, converted to base currency, displayed as a secondary stat alongside the net figure (see CLAUDE.md rule 14 — this is the fix for installment info being previously buried in each person's detail view). If no debts have an installment plan, this stat is omitted rather than shown as zero.
Smart search bar (SearchInput primitive): placeholder "search by name/date/note". Live filtering matches group name, any transaction's notes/date/stringified amount, group phone, email, or company.
Person cards list (ListRow + Avatar primitives): empty state via EmptyState when no debts exist or search yields nothing. Each row: Avatar (photo or first-letter initial; ring colored by net status — positive/negative/settled), name, phone row with WhatsApp glyph when phone exists, transaction count, right-aligned net total colored by type, trailing chevron (IconButton, direction follows language). Card ordering: sorted by absolute net value descending, from groupedDebts.

1.3 Grouping engine (groupedDebts in FinanceContext)
Debts grouped by trimmed name (exact match). Each group accumulates: transactions array, running totalNet (each amount converted to base currency), and merges the first-found non-empty phone/avatar/email/company/contactId. Type classification: positive (>0), negative (<0), settled (=0). Context also exposes debtFilter ('all' | 'positive' | 'negative') for filtering groups — not currently surfaced in the UI, available for future use.

1.4 Detail view (per-person) — shown when a person is tapped
Header: circular back IconButton, large Avatar (96px) with type-colored ring, person name centered below. Contact chips row (only when contact info exists): phone chip (tappable → WhatsApp, see 1.6), email chip, company chip — display-only.
Total net card: full-width, tinted by type, uppercase label + large net amount in base currency.
Transaction history: section label, container list with dividers. Each row: icon tile (TrendingUp/emerald for money owed to me, TrendingDown/rose for money I owe), type label + optional date, amount in the transaction's original currency, edit IconButton (opens DebtModal), delete IconButton (opens ConfirmModal). Expandable info panel when notes or installment info exists: notes line, and for negative debts with monthlyPayment > 0 — "Installment details: {monthly} monthly" plus the start→end date range (or "no end date" when unset).

1.5 Delete confirmation
Uses the shared ConfirmModal primitive (icon badge, title, person name as subtitle, Cancel/Delete button pair). Delete removes the debt by id, then optimistically updates the open person view — recomputes totalNet and reclassifies type; if the person has zero remaining transactions, the detail view auto-closes.

1.6 WhatsApp integration
Triggered from the phone chip in detail view. Phone normalization: strips spaces/dashes/parentheses, removes leading + or 00, and a leading national 0 is replaced with country code 966 (Saudi default — international users should store full numbers). Builds a message: greeting with the person's name, total via formatMoney (base currency), then a bulleted per-transaction summary (type + original-currency amount + optional date). Opens the WhatsApp deep link guarded by a canOpenURL check.

1.7 DebtModal (components/DebtModal.tsx)
Built from GlassModal + react-hook-form/zod (CLAUDE.md rule 5). Debt-specific features:
Contact import: "Import from Contacts" button opens ContactsPicker (1.8) when no contact is linked; once linked, shows a compact contact card with an unlink action. Editing the name manually after linking clears the link (manual entry stays authoritative).
Name auto-suggest: existing unique debtor names matching the typed prefix appear in a floating dropdown; tapping fills the name.
Type toggle: segmented control, "I owe" (negative) / "Owed to me" (positive) — drives accent coloring of the amount field.
Fields: Amount (AmountInput + embedded searchable currency CustomSelect, all 20 codes) · Date (YYYY-MM-DD, pre-filled today) · Notes · Monthly payment (only when type = negative — see CLAUDE.md rule 14, this stays) · Installment dates panel (start required + end optional, only when type = negative AND monthlyPayment > 0) · Phone (LTR, phone-pad keyboard) · Email + Company.
Validation (zod, rendered via InlineBanner): name required, amount required, date must be a valid YYYY-MM-DD date, and for negative debts with installments — valid start date required, valid end date required if provided.
Save behavior: edit mode patches the debt by id and, if that person is currently selected, recomputes their view live; create mode prepends a new debt and, if the name matches the currently-selected person, updates the selection instantly. Installment dates are only stored for qualifying negative-installment debts, otherwise omitted.

1.8 ContactsPicker (components/ContactsPicker.tsx)
Full-screen modal launched from DebtModal. Requests contacts permission on open; loads phone numbers, emails, company, and photo. States: loading, permission-denied (with explanation + Go Back), empty ("No contacts found"), or a searchable scrollable list (SearchInput + ListRow + Avatar). Selecting emits { name, phone, avatar, email, company, contactId }, which DebtModal merges into its form.

PART 2 — EXPENSES SCREEN (src/pages/Expenses.tsx)

2.1 Layout skeleton
Same shell pattern as Debts — FlashList, safe-area-aware padding, direction-aware entrance animation.

2.2 Summary block
Title + subtitle, divider, then Monthly Total: sum of all expenses normalized to monthly equivalents (any period, via getMonthlyEquivalent) and converted to base currency.

2.3 Quick Add — name-autocomplete backed by brandIcons.ts
As the user types a name in ExpenseModal (or in a lightweight quick-entry field on the Expenses screen itself), live-match against src/constants/brandIcons.ts (CLAUDE.md rule 7) plus a small curated table of { category, defaultPeriod, defaultPriceUSD } for common recurring services (streaming, software, utilities). A match pre-fills the icon (IconTile with the matched brand logo), category, and a currency-converted suggested price; the user still lands in ExpenseModal to review before saving — quick add never creates a record silently. Above the autocomplete, show a slim one-tap row (quick-chip pattern) of the 8-10 most universal picks (Netflix, Spotify, rent, electricity, etc.) for the single-tap case, ending in a dashed "Search brands" affordance that represents the full autocomplete rather than being a real button. Duplicate check by trimmed-lowercase name — silently ignored if an expense with that name already exists. Default prices convert at add-time only (not dynamically); later base-currency changes don't retroactively alter saved amounts.

2.4 Filters
SearchInput matching expense name or notes. Category chips (Badge primitive, filter-chip variant): All + the 5 canonical categories (Essential, Personal, Subscriptions, Entertainment, Emergency). Filtering = search match AND category match.

2.5 Expense list
Sort rule: unconfigured expenses (amount === 0) float to the top; the rest sort newest-first. Empty state via EmptyState. Each row (ListRow + IconTile): translated name, badges row (category Badge always, period Badge only when amount > 0), and on the right — either an amber "Setup cost" affordance for unconfigured expenses, or the converted amount for configured ones. Edit/delete IconButtons. Notes footer when present.

2.6 Delete confirmation
Same ConfirmModal primitive as Debts (1.5). Confirm removes the expense by id; totals are derived, no extra recalculation needed.

2.7 ExpenseModal (components/ExpenseModal.tsx)
Built from GlassModal + react-hook-form/zod. Fields: Name (drives the Quick Add autocomplete from 2.3) · Amount + Currency (AmountInput + embedded searchable CustomSelect; new-expense default currency = base currency) · Period (CustomSelect: daily/weekly/monthly/3-6-9 months/yearly/custom, default monthly) · Custom days (only when period = custom) · Notes (auto-clears default reminder placeholder text once a real amount is set) · Category chips (same 5, default Essential) · Icon picker: a grid of IconTiles — the 26 generic category icons plus whatever brandIcons.ts matches were curated for common services (CLAUDE.md rule 7); selecting one overrides whatever the name-autocomplete picked.
Validation (InlineBanner): name required, amount required. Duplicate detection: same trimmed-lowercase name as another expense (excluding self in edit mode) blocks save with an explanation. Edit mode patches the matched expense by id; create mode prepends a new one. Sentinel handling for quick-add placeholders falls through to create-mode.

PART 3 — SETTINGS SCREEN (src/pages/Settings.tsx)
Acts as a host container with an internal router. Current sub-screen lifted to app state: settingsScreen ∈ { 'main', 'edit-profile', 'data' }, persisted, survives tab switches and app restarts.

3.1 Navigation
Own GlassHeader instance (back IconButton + title, swapping per sub-screen) replaces the default header while any Settings screen is active. Back behavior: sub-screen → main; main → previousTab (exact originating tab).

3.2 Main hub sections
A. Profile card: Avatar (larger, accent-ring per the approved design) + name + a monthly-income meta line (icon + amount, real data from IncomeSource records — not a placeholder). Tappable to navigate to Edit Profile; no separate Edit button on the card itself.
B. Appearance card: Theme grid — one tile per theme (the 4 locked themes), each showing its accent swatch and localized name; selected tile gets a glow in its own accent color. Tap switches theme instantly (persisted). Language row (Globe IconTile + CustomSelect, Arabic/English, instant dir/i18n switch). Font size row (Aa IconTile + SegmentedControl: Small/Normal/Large/XLarge, sets fontScale, persisted, drives text scaling app-wide).
C. Base currency row: Coins IconTile + searchable CustomSelect listing all 20 currencies. Changing it re-derives every converted figure app-wide.
D. Backup & Data row: Shield IconTile + trailing "Export (JSON)" label → navigates to Data screen (Phase 2).
E. Notifications row: Bell IconTile + ToggleSwitch. Currently a visual-only placeholder (rendered on, not yet wired to a real toggle handler) until the notification engine (CLAUDE.md rule 10) is fully built — do not wire it to fake state, just don't make it interactive yet.

3.3 EditProfileScreen (Phase 2) — sub-screen
Profile card: avatar upload (image picker, square crop, stored as base64), inline name editing. Income line + financial-health badge (computed from savings rate — four tiers from "excellent" down to "critical", each with its own color).
Current balances manager: add-row (name, amount, searchable currency), add button disabled until both fields filled. Adding or removing a balance stamps lastReconciledDate = now. Rows show name, currency tag, amount, remove button. Footer shows total balances count + converted sum.
Income sources manager: identical add-row pattern. Rows removable; footer shows source count + total combined income.

3.4 DataScreen (Phase 2) — sub-screen
Wrapped in a SettingsCard. Header row: Shield tile + backup title/description. Status/success/error messages render via the shared InlineBanner (not a bespoke "Flash banner").
Export/Import file row: Export builds a JSON snapshot ({ expenses, debts, incomes, profile, currency, theme }), writes a dated file, opens the native share sheet. Import (file, restricted to JSON): parses and appends — expenses/debts/incomes arrays are concatenated onto existing data (never overwrite), with imported ids regenerated to avoid collisions; profile is merged shallowly.
Auto-backup panel: frequency SegmentedControl (Off/Daily/Weekly/Monthly) — choosing Off also clears lastBackup. Status line shows humanized last-backup time. Backup Now performs an immediate snapshot. Restore (appears only when frequency ≠ off and a backup exists) restores from the snapshot.
Paste-JSON import: multiline editor, same append+rekey pipeline as file import, disabled while empty.
AI prompt copier: buttons to copy the debts/expenses prompts (src/prompts/*) to clipboard, with a brief "copied" confirmation state. Caption explains the workflow: paste the prompt + messy notes into an external LLM the user chooses, paste the resulting JSON back into the box above (this is the one deliberate exception to "no external calls" — see CLAUDE.md rule 1).

PART 4 — SHARED BOTTOM-SHEET MODAL MECHANICS (GlassModal, used by DebtModal + ExpenseModal + ConfirmModal)
Mount pattern: component always mounted, early-returns null unless its modal is the active one. Keyboard-avoiding on both platforms. Backdrop tap closes. Sheet: bottom-anchored, max height 90%, rounded top corners per the locked radius token. Decorative themed top-edge border strip + drag-handle pill. Swipe-to-dismiss on the handle area (downward drag past a distance/velocity threshold animates the sheet closed, otherwise springs back). Close always clears the active-modal state and any editing entity. Prefill effect: forms hydrate from the editing entity when editing, or sensible new-record defaults when creating. Validation errors render through the shared InlineBanner, auto-clearing after a few seconds or the moment the offending field is edited again. Submit buttons use GradientButton; labels swap between create/edit variants.

PART 5 — DATA MODELS REFERENCE (src/constants/initialData.ts)
```ts
interface Expense {
  id: number; name: string; amount: number; icon: string; category: string;
  currency?: string; period?: string; notes?: string;
  translationKey?: string; customPeriodDays?: number;
}

interface Debt {
  id: number; name: string; amount: number; monthlyPayment: number;
  type: 'positive' | 'negative'; date: string; notes?: string;
  startDate?: string; endDate?: string; currency?: string;
  phone?: string; avatar?: string; email?: string; company?: string; contactId?: string;
}

interface Profile {
  name: string; avatar: string;
  startBalances?: { id: number; name: string; amount: number; currency: string }[];
  lastReconciledDate?: string;
}

interface IncomeSource { id: number; name: string; amount: number; currency: string; }
```
No Target type, no targets field on Profile, no emergencyBufferMonths — see CLAUDE.md rule 13.

Derived values produced by FinanceContext:
totalExpenses — monthly-normalized, base-currency total (Expenses header).
debtsCalculations.totalPositiveAmount / totalNegativeAmount / totalNegativeMonthly — Debts header net, effective income, and now also the Debts summary card's installment-total stat (rule 14).
groupedDebts — per-person groups (Debts list).
effectiveIncome = income − totalNegativeMonthly · netSavings = effectiveIncome − totalExpenses · savingsRate % · financialHealth grade (EditProfile badge).
Dashboard-related derived values (totalStartBalance / monthsElapsed / calculatedCurrentBalance) exist in the data model but are not wired into any UI yet — see CLAUDE.md rule 15.

PART 6 — NOTABLE BEHAVIORS, QUIRKS & EDGE CASES
Quick-add duplicate guard is silent — matching an already-added service does nothing.
Subscription/service default prices convert at add-time, not dynamically — later base-currency changes don't retroactively alter saved amounts.
Deleting a debt inside a person view optimistically patches the selection instead of waiting for regrouping.
WhatsApp country-code assumption: local numbers starting with 0 get Saudi 966 prefix — international users should store full numbers.
Notifications toggle is currently decorative — no scheduler wired behind it until the notifications work (rule 10) is built.
debtFilter exists in context (positive/negative/all) but has no UI control on the Debts screen today — available for future use.
Import always appends — importing the same backup twice duplicates records (ids are regenerated to keep list keys unique).
Exchange rates are static constants (SAR-base) — no fetch/live-rate mechanism.
All list empty-states share one visual language via the shared EmptyState primitive — never reimplemented per-screen.
