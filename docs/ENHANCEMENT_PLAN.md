# BirdsEye Finance — Enhancement Plan (Reconciliation, Targets, Investments)

Status: **proposed, not yet built.** This is a draft for review — once agreed, the relevant sections
get merged into `FEATURE_SPEC.md` (screen behavior) and `PHASES.md` (as new numbered phases), and
CLAUDE.md rule 13 gets formally amended. Nothing in this doc should be treated as current app
behavior until that merge happens.

Origin: conversation-driven brainstorm. Core thesis — the app's value is "real logged numbers vs.
what was expected," and that same reconciliation pattern should power targets and investments too,
not just the balance check. Everywhere below, **logged/manual beats computed/assumed** whenever the
two would otherwise conflict.

---

## 0. CLAUDE.md changes required

Rule 13 currently reads "Goals/Targets: permanently out of scope." That was correct for v1 scoping;
the app is now past that phase and the user wants targets + investments added. Proposed replacement:

> 13. **Targets & Investments** are in scope. `targets`, `target_contributions`, `investments`, and
> `investment_value_snapshots` live in Drizzle per rule 1. Target/investment progress is driven only
> by manually-logged contributions and a single aggregate portfolio-value log — never an
> auto-computed projection from blended savings rate. Investment value is always visually distinct
> from committed cash (estimate vs. real). This rule only lifts the targets/investments
> restriction — `emergencyBufferMonths` and any `'goal'` settingsScreen enum value stay out of scope
> unless separately reopened.

Also add a new rule (or fold into rule 15) once Dashboard's real-data build lands: Dashboard is no
longer "placeholder only" — strike the "no rich data, no forecasting, no balance calculations wired
up" language and replace with a pointer to whichever phase in PHASES.md finishes this plan.

**Do not implement any of this until that rule edit is made explicitly** — same sign-off bar as a
`theme.ts` change.

---

## 1. New data model (Drizzle, expo-sqlite — rule 1)

All amounts follow the existing pattern: store `amount` + `currency` (not pre-converted), convert to
base at render time via `convertToBase`, same as `expenses`/`debts`.

**`balance_snapshots`** — the reconciliation log.
`id, date, amount, currency, note?, createdAt`. Each row is a user-typed "here's what I actually
have today." Replaces relying on `profile.lastReconciledDate` as a bare timestamp with no history —
that MMKV field can now derive from `MAX(date)` on this table instead of being separately maintained
(or keep both if a cheap sync-free timestamp is still useful for the "stale nudge" check).

**`targets`**
`id, name, categoryHint, targetAmount, currency, targetDate?, plannedFinancedAmount (default 0), status ('active'|'achieved'|'abandoned'), linkedDebtId?, createdAt`.
`plannedFinancedAmount` is the portion the user intends to cover via installment rather than save
in cash (e.g. car = 100k, plans to finance 70k → only 30k needs to be reached by saving).

**`target_contributions`**
`id, targetId, balanceSnapshotId?, amount, currency, date, note?`. Created during the manual
allocation step (see §3) when a balance snapshot is logged. `balanceSnapshotId` links back to the
logging event it came from, when it came from one (vs. a manual one-off contribution).

**`investments`**
`id, name, category ('stocks'|'realEstate'|'business'|'crypto'|'other'), principalAmount, currency, date, linkedTargetId?, note?`.
One row per thing bought — not itemized valuation.

**`investment_value_snapshots`**
`id, date, totalValueBase, note?`. **One aggregate number for the whole portfolio**, not per-holding
— this matches the "I only log the total ROI for everything" decision. Aggregate ROI% =
`(latest totalValueBase − Σ principalAmount) / Σ principalAmount`. Any per-investment "current value"
shown in the UI is `principal × (1 + aggregateROI%)` — a pro-rated estimate, always labeled as such,
never treated as a real tracked figure.

---

## 2. New shared UI primitives

Adds to CLAUDE.md rule 4's roster — flag for the same explicit sign-off as any other primitive-list
change.

> `BalanceRevealCard` already shipped (ahead of this plan, at the user's request) — see
> `src/components/ui/BalanceRevealCard.tsx`. It's Home's hero now: masked by default (fixed-length
> dot run, not sized off the real digit count — see `MoneyAmount`'s `masked` prop), tap anywhere to
> reveal, resets hidden on every cold start (no MMKV persistence, per §6 decision 1). §3 below
> reflects this as already-live, not proposed. The one piece still pending reconciliation (§1): a
> second line showing the expected-vs-actual variance once `balance_snapshots` exists.

- **TargetProgressCard** — one target: category icon, name, `RingGauge`/`ProgressBar` fill (saved ÷
  targetAmount), amount saved/remaining, projected-date shown as a **range**, never a hard date
  ("~14–18 mo at current pace" not "March 2027").
- **InvestmentSummaryCard** — total principal vs. latest logged value, ROI delta, staleness
  indicator (muted text/dot if the last value log is old). Distinct tint from BalanceRevealCard —
  it must never be visually confusable with real cash.
- **ReconciliationNudgeCard** — dismissible `InlineBanner`-style prompt shown when the last balance
  log exceeds a staleness threshold (e.g. 30 days). CTA opens the same Log Balance flow as the FAB.
- **VarianceHistoryChart** — Analytics' expected-vs-actual trend across logged periods, reusing the
  existing `ProgressBar`/`DonutChart` visual language — no new charting dependency.
- **AllocationRow** — the manual-split step inside Log Balance: one `AmountInput` row per active
  target plus "unallocated," running total validated against the logged amount, using existing
  `AmountInput`/`ListRow` composition.

The five below reuse `RingGauge`/`ProgressBar`/`DonutChart`/`StatTile`/`AmountInput`/`GlassModal` —
no new gesture idioms, no new chart library, consistent with what's already in `src/components/ui/`.

---

## 3. Home (Dashboard) — additions to the existing layout

Current layout: `FEATURE_SPEC.md` Part 7 (planned for 2.2.0: greeting → Current Balance hero
(`BalanceRevealCard`) → Coming up → This month → Debts). The insertions below are placed relative to
that layout.

Remaining proposed insertions (not yet built), in order:

1. Greeting, Current Balance hero, Financial-health hero + stat grid, itemized balances list — all
   already live, unchanged by what follows.
2. **ReconciliationNudgeCard** — conditional, only when the balance log is stale. Slots in right
   after the Current Balance hero once `balance_snapshots` (§1) exists.
3. **Targets carousel** — horizontal scroll of `TargetProgressCard`s (small/bounded list, not
   FlashList-worthy), "See all" link to a target list/detail drill-down.
4. **InvestmentSummaryCard** — single card, tap → investment list/detail.

## 4. Analytics — additions to the existing layout

Current layout: `FEATURE_SPEC.md` Part 8 (spending-by-category donut → stat grid → expense-to-income
bar; the top-expenses list was removed in 2.1.0).

Proposed insertion:

1. Spending-by-category donut — unchanged.
2. **VarianceHistoryChart** — new, expected-vs-actual trend + latest-gap insight text (e.g. category
   deltas that plausibly explain the gap, reusing the same category math already computed here).
3. Stat grid — unchanged, one new tile: aggregate investment ROI% (plain `StatTile`, no new
   component needed).
4. Expense-to-income bar, top expenses — unchanged.
5. *(stretch, not core)* Targets rollup line — "2 of 3 targets on pace."

---

## 5. FAB behavior

- **Home tab** — opens a `GlassModal` quick-action sheet (bottom sheet, existing primitive) with
  three `ListRow` entries: **Log Balance**, **New Target**, **New Investment**. This is the one
  screen with more than one legitimate primary action, so it gets a sheet instead of guessing.
- **Analytics tab** — single action, opens **Log Balance** directly, no sheet. It's the only action
  that makes sense there, and it's the one that most directly improves what the screen shows.
- **Expenses / Debts tabs** — unchanged (Add Expense / Add Debt, as today).

Today (FEATURE_SPEC 0.1) the FAB on Home and Analytics switches to Debts and opens a new debt;
this section would replace that behavior.

---

## 6. Decisions (resolved)

1. **Balance-reveal persistence** — hidden again on every cold start. No MMKV persistence for the
   reveal state; it's local component state only, reset every launch. **Shipped** —
   `BalanceRevealCard` already implements this.
2. **IA for full Targets/Investments lists** — nested drill-down under Home's own stack, mirroring
   the Debts person-list → detail pattern. No new navbar tab.
3. **Target category taxonomy** — free-text name + a loose category bucket
   (`bigPurchase`/`lifeEvent`/`business`/`other`) used only to pick an icon. Never blocks on a
   category that doesn't fit.
4. **Missed target date** — passive "behind schedule" label on the `TargetProgressCard` only. No
   notification, no auto-close/abandon, no new infra beyond the label state.

### Reconciliation core — approved 2026-09-16, ships as 2.3.0
§0's blanket gate is lifted **for reconciliation only**: `balance_snapshots` and everything in this
block are approved. Targets and investments stay blocked until rule 13 is actually replaced.

5. **Home's Current Balance comes from the log.** Once a balance has been logged, Home shows that
   figure aged forward by net savings, not the sum of the accounts typed in Edit Profile. Those
   typed accounts stay editable and act as the seed before the first log (and as the per-account
   detail after it). This is the plan's thesis — logged beats computed.
6. **A log is one total**, not per account: amount + currency + optional note, dated today by
   default. Fast enough to repeat monthly; the account breakdown already lives in Edit Profile.
7. **Expected ages by days**, not whole months: `expected = last logged balance + netSavings ×
   (days since that log ÷ 30.44)`, the same period math `getMonthlyEquivalent` already uses, so a
   mid-month check is meaningful. Variance = logged amount − expected.
8. **The FAB opens Log Balance directly** on Home and Analytics for this release. §5's three-entry
   quick-action sheet waits until targets and investments exist — today it would have one real entry.

Still to approve before code (same sign-off bar as any rule change): **rule 15**, so Home may show
the expected-vs-actual variance, and **rule 4**, 26 → 28 primitives for `ReconciliationNudgeCard`
and `VarianceHistoryChart`. Rule 13 is untouched.

---

## 7. Suggested phase sequencing (for PHASES.md once approved)

Renumbered 2026-09-16: `PHASES.md`'s Phase 6 is the shipped Debts v2, so this plan starts at 7.

- **Phase 7 — Reconciliation core.** *(Approved; the 2.3.0 release.)* `balance_snapshots`, expected-vs-actual formula,
  `ReconciliationNudgeCard`, FAB "Log Balance" wired on Home + Analytics, `VarianceHistoryChart`.
  (`BalanceRevealCard` already shipped ahead of this phase — see §2/§3.) Foundation everything else
  hooks into.
- **Phase 8 — Targets.** `targets` + `target_contributions`, `AllocationRow` inside the Log Balance
  flow, `TargetProgressCard` + carousel, target create/detail screens, convert-to-Debt on a
  financed target's completion.
- **Phase 9 — Investments.** `investments` + `investment_value_snapshots`, `InvestmentSummaryCard`,
  aggregate ROI, optional target linkage shown as a separate "could accelerate this" line (never
  blended into the committed-cash projection), staleness nudges.
- **Phase 10 (stretch) — Supporting data.** Zakat calculator + Hijri-aware reminder (manual Nisab
  price entry, no external API per rule 1), manually-entered annual inflation rate for a
  real/nominal savings-rate view, expense category anomaly flags, debt payoff velocity,
  financial-health history trend.

---

## 8. Online backup — method to be chosen by the user

Separate topic from the reconciliation/targets/investments work above. Added 2026-09-15 from a
conversation about backups. **Nothing here is decided or built.** The user picks a method here
before any work starts.

**Deferred (2026-09-15):** at the user's request this is the last item in the plan, built after
everything else. Research already done (re-check package versions when work starts):
- Google Drive most likely does not appear in Android's folder picker (`ACTION_OPEN_DOCUMENT_TREE`,
  which `Directory.pickDirectoryAsync` uses); it does appear in the file picker and the share sheet.
  Check on a device before relying on a Drive folder.
- expo-file-system 57 (native source): the folder picker takes a persistable read+write permission;
  copying a `file://` file into a SAF folder works; `rename` does not work on SAF; `ReadWrite` file
  handles are not supported on SAF.
- Zip: `react-native-zip-archive` 9.5.1 (zip4j on Android) streams from disk, supports AES-256,
  cancel/`AbortSignal` and per-file progress; its config plugin is a no-op. It takes file paths only
  (build in the cache, then copy out; a restore needs about 2× the backup's size free). Pure-JS
  options (fflate, JSZip, zip.js) run on the JS thread, are in-memory or slow, and lack AES.
- `expo-background-fetch` is deprecated in favor of `expo-background-task` (WorkManager, at most every
  15 min, requires a network connection). A "backup due" check on launch/foreground needs no new module.
- `android.allowBackup` is a supported `app.json` key (default `true`). Over 25 MB Android keeps the
  last cloud backup, so a reinstall can restore stale data.
- The legacy debt contact columns are still read by `backfillPeople()` for installs upgrading from
  before 2.0.1 (the `people` table arrived in 2.0.1) — dropping them must keep that path working.
- Moving off the debug signing key forces every user to reinstall; do it only after the full backup
  exists, or users lose their proofs.

### Why
- The app's only way to move data today is a JSON export/import. It carries every record, but **not
  the attachment files (receipt photos, screenshots, PDFs) or app-picked person/profile photos**,
  so importing on a new phone loses every proof. Proofs are important and must travel with the data.
- The in-app local auto-backup (a snapshot in MMKV with Restore) is removed in 2.1.0 — the
  user wants data always current, and the Data screen to be import/export only, plus online backup
  later. So online backup is the one planned backup feature.
- Android's built-in Auto Backup (`android:allowBackup="true"` today) is not a substitute: it's
  silent, has no user control, and skips the whole app once its data passes 25 MB, which proofs
  will. Decide separately whether to keep it on, restrict it, or turn it off, so a system restore
  can't bring back a database without its files.

### Needed by either option
- **A full backup file**: one archive (e.g. `.zip`) holding the data JSON plus every attachment and
  app-picked photo, restorable on a new phone with ids and file names remapped (reuse
  `appendSnapshot`/`insertDebtGraph`). Needs a native zip library.
- **Restore semantics**: replace everything vs. add to existing data — ask the user.
- **Optional password encryption** of the backup file (financial data and proofs).
- Large files: proofs can make backups big — show size and progress, and handle low storage.

### Option A — Google Drive integration, WhatsApp-style
The user signs in with Google in the app; backups upload to a hidden app folder on their Drive
(`appDataFolder`), on a schedule and on demand; a new phone lists and restores them after sign-in.
- **Pros:** closest to WhatsApp; restore is discoverable right after signing in.
- **Cons / requirements:**
  - CLAUDE.md **rule 1 exception** — the app itself calls Google's APIs.
  - Google Cloud project, OAuth consent screen, native Google Sign-In module, token handling.
  - OAuth is tied to the app's **signing key**: move off the public debug key first (existing users
    reinstall once), or the Drive client is bound to an insecure key.
  - Changes the "completely local and private" promise on the About page and README.
  - More code to maintain: upload retries, background scheduling, Google API changes.

### Option B — full backup file to a folder the user picks (can be a Google Drive folder)
The user picks a folder once through Android's folder picker (`Directory.pickDirectoryAsync` in
expo-file-system). The Google Drive app appears there, so a Drive folder works. The app writes the
full backup file there on a schedule or on demand; the Drive app syncs it. A new phone imports by
picking that file.
- **Pros:** no sign-in or Google API in the app — the app never contacts the internet itself, so it
  fits rule 1 almost as-is; works with Drive, OneDrive, local storage, a USB drive; no Google Cloud
  setup; independent of the signing key.
- **Cons / requirements:**
  - Restore is manual (pick the file), not listed automatically.
  - Background writes into a Drive-provided folder must be verified on real devices.
  - Needs the same native zip library and full-backup format as option A.

### Decision (to fill in)
- Method: A / B
- Restore semantics: replace / add
- Password encryption: yes / no
- Schedule options: e.g. off / daily / weekly
- Android Auto Backup: keep / restrict / off
- Target release: last in the plan, after everything else

