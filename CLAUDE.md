# BirdsEye Finance

Local-first Expo/React Native app. Read `docs/FEATURE_SPEC.md` for full screen-by-screen behavior and `docs/PHASES.md` for what's built and what's next before starting any work.

## Architecture rules

1. **Local-first, always.** No external backends or APIs. Relational data (People, Debts, Debt adjustments, Debt attachments, Expenses, Income Sources) lives in expo-sqlite via Drizzle ORM — typed schema, drizzle-kit migrations, no raw SQL strings scattered across screens. Preferences (theme, currency, language, font scale) live in react-native-mmkv for synchronous reads. Attachment files and app-picked person photos live in the app's document directory, referenced from SQLite by relative file name only (`src/lib/attachments.ts`, `src/lib/avatars.ts`). One deliberate exception: the AI-import prompts in `src/prompts/` are meant to be copy-pasted by the user into an external LLM of their choosing — a manual, user-initiated action, not the app calling out on its own.

2. **Theme init:** hold `expo-splash-screen` until the theme is synchronously read from MMKV — zero flash of wrong colors or white screen on cold start.

3. **Design tokens are frozen, and they are the only source of visual values.** `src/constants/theme.ts` holds the locked palettes (Platinum/Emerald/Obsidian/Sapphire), `SEMANTIC` status colors (positive/negative/warning), `SUPPORT_TINTS` (About's support buttons), `RADII`, glass constants, and font tokens — created in Phase 1, exact values in `docs/PHASES.md`. Treat any edit to `theme.ts` itself as requiring explicit user sign-off first — don't "improve" it. Outside `theme.ts`, **no hardcoded visual values anywhere** — screens, feature components, and primitives alike:
   - **No color literals.** No hex, no `rgb()`/`rgba()` strings, no named colors, no ad hoc Tailwind color classes. Read `theme.*` / `SEMANTIC.*`; derive any tint or wash with `withAlpha(token, alpha)` from `src/utils/color.ts`. If no token fits, ask for a new token (sign-off) — never inline one.
   - **No one-off radii.** Use `RADII`.
   - **No locally re-styled copies of a shared primitive** (a hand-built pill instead of `Badge`, a hand-built message box instead of `InlineBanner`, a hand-built row instead of `ListRow`). If a primitive lacks the look you need, add a variant to that primitive so every screen shares it.
   - Exempt: brand-logo hexes in `src/constants/brandIcons.ts` (icon data, not design tokens); a circle's radius (half its own size — shape math, not a radius token); an SVG mask's fill (its alpha channel, not a rendered color — mark it with an eslint-disable comment saying so).
   - Enforced by ESLint `no-restricted-syntax` in `eslint.config.js` at `error` — lint fails on any hardcoded color outside the token file.

4. **18 shared primitives in `src/components/ui/`, composed everywhere, duplicated nowhere:** GlassHeader, GlassModal (bottom sheet: drag handle, swipe-to-dismiss, backdrop), GradientButton, SecondaryButton (outline — neutral, or tinted via `color` — with optional icon/leading glyph/trailing icon, plus a `link` variant for inline text actions and a `pill` variant — accent, tinted or neutral — for About's buttons), IconButton (circular icon tap target — back/edit/delete/chevron — RTL flip built in), SettingsCard, ListRow (icon-or-avatar + title + subtitle + trailing value — base for transaction rows, person rows, settings rows), CustomSelect (incl. searchable mode), Avatar (photo | initials, status ring, circular, person-specific), IconTile (square/rounded tinted tile for a category icon or brand logo — distinct from Avatar), SearchInput (icon + placeholder + clear — one implementation, used in Debts search, Expenses search, ContactsPicker, and CustomSelect's searchable mode), AmountInput, Badge (category/period/status pill — neutral/accent/positive/warning/negative tones — plus a tappable chip variant with optional leading icon and dashed "add" outline), ToggleSwitch, SegmentedControl, InlineBanner (success/warning/error — the one component behind every message and every modal validation error), ConfirmModal (delete-confirmation sheet — icon badge + title + Cancel/Delete — one implementation, reused for Debt and Expense deletion), EmptyState (dashed border + muted icon + caption, used by every empty list).

5. **Forms:** DebtModal/ExpenseModal (and the Edit Person / adjustment sheets) use react-hook-form + zod. Errors render through InlineBanner. Form text inputs use the shared `TextField` (`src/components/FormField.tsx`), never a bare `TextInput`, so the field look and placeholder/cursor colors always come from the theme.

6. **Unbounded lists** (Debts person list, Expenses list, transaction history, adjustment ledger, History tabs, people pickers, attachment strips) use `@shopify/flash-list`, never `ScrollView` + `.map()`.

7. **Brand icons:** `simple-icons` via npm (`npm install simple-icons`) — no local icon folder involved. A one-time build script extracts a curated ~150-300-icon subset relevant to personal finance into `src/constants/brandIcons.ts` as flat `{ slug, title, hex, path }[]`, rendered via `react-native-svg` (path data, not SVG files — no transformer needed). Expense name-autocomplete matches against this; unmatched falls back to generic category icons, then an auto-generated colored initial-letter IconTile. Every expense renders *something*, offline, deterministically.

8. **Glassmorphism:** `expo-blur` + Reanimated for headers/navbars/modals, intensity/tint from tokens, never inline.

9. **RTL:** Arabic + English. NativeWind logical properties (`start`/`end`, never `left`/`right`) throughout. Exception: the FAB stays at a fixed physical position regardless of language — deliberate, not an oversight.

10. **Notifications:** `expo-notifications` + `expo-task-manager`/`expo-background-fetch` re-evaluating debt deadlines on mount and daily in the background. Must be verified on an **EAS Development Build** — Expo Go cannot run background tasks or reliably deliver local notifications. Don't report this "done" from Expo Go testing.

11. **Engineering hygiene:** TypeScript strict from day one. Path aliases (`@/components`, `@/context`, `@/db`, `@/constants`). ESLint + Prettier passing before any phase is called complete. Any Context-derived value (`groupedDebts`, `totalExpenses`, financial health grade, etc.) wrapped in `useMemo` with correct deps.

12. **Accessibility:** every IconButton gets `accessibilityLabel`. Text respects fontScale via the shared scaled-text pattern.

13. **Goals/Targets: permanently out of scope.** No targets table, no `Target` type, no `targets` field on Profile, no UI referencing targets/goals, no `emergencyBufferMonths`, no `'goal'` in the settingsScreen enum. If `docs/FEATURE_SPEC.md` mentions it anywhere, ignore that mention.

14. **Debt installments stay on Debt, not Expense.** `monthlyPayment`/`startDate`/`endDate` remain on the Debt record. Reason: `totalNegativeMonthly` (derived from these) is subtracted from income *before* `totalExpenses` in the savings-rate math specifically because debt service isn't discretionary spending — modeling installments as Expense records would collapse that distinction. The Debts summary card also surfaces the aggregate monthly installment total (see `docs/FEATURE_SPEC.md` Part 1.2) so this isn't buried in per-person views anymore. Every debt total (net balance, per-person net, `totalNegativeMonthly`) uses each *active* debt's outstanding amount — original principal plus its adjustments — so settled debts and their installment plans stop counting.

15. **Dashboard is intentionally minimal** until its own phase — no rich data, no forecasting, no balance calculations wired up. Placeholder screen only.

16. **About screen** has no content spec anywhere — it's only referenced via routing. Build it as a stub: logo, app name, version number, nothing invented.

## Priority when things conflict
Visual details (colors, exact radii/spacing) → the locked tokens and approved design preview win. Everything about *what a screen does* → `docs/FEATURE_SPEC.md` wins. Anything about *how the codebase is organized* → this file wins.
