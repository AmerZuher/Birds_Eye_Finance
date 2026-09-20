import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react-native';

import { Badge } from '@/components/ui/Badge';
import { GlassModal } from '@/components/ui/GlassModal';
import { IconButton } from '@/components/ui/IconButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { RADII } from '@/constants/theme';
import {
  dateParts,
  daysInMonth,
  firstWeekdayOfMonth,
  formatDateLong,
  formatDateMedium,
  formatDayNumber,
  isValidDateStr,
  monthLabel,
  toDateStr,
  todayStr,
  weekdayInitials,
} from '@/lib/dates';
import { withAlpha } from '@/utils/color';

const COLUMNS = 7;
/** Six rows always fit a month, so the sheet never changes height between months. */
const ROWS = 6;

interface DateFieldProps {
  /** A local YYYY-MM-DD, or '' when nothing is set. */
  value: string;
  /**
   * Uppercase label rendered inside the field, the way AmountInput carries its
   * own — pass it instead of wrapping this in a FormField, so a date block has
   * the same weight as the amount block above it.
   */
  label?: string;
  /** The tighter one-line look, for two dates sharing a row (a plan's start and end). */
  compact?: boolean;
  onChange: (value: string) => void;
  /** Shown in the field while nothing is set. */
  placeholder: string;
  /** The calendar sheet's title — normally the field's own label. */
  sheetTitle: string;
  /** Names the field for screen readers (CLAUDE.md rule 12). */
  accessibilityLabel: string;
  /** Offers a Clear action — for dates that are genuinely optional, like a plan's end date. */
  clearable?: boolean;
  /** Earliest selectable date, YYYY-MM-DD — e.g. an end date can't precede its start. */
  min?: string;
  /** Latest selectable date, YYYY-MM-DD. */
  max?: string;
}

/**
 * A date is picked from a calendar, never typed (FEATURE_SPEC 0.10). The field
 * itself is `useTextFieldStyle`'s look — the same border, fill and radius every
 * other form field has, not a re-styled copy of it — with the value on the
 * start side and a calendar glyph on the end; tapping it opens a month grid in
 * a `GlassModal`, the same nested-sheet pattern `CustomSelect` already uses
 * from inside a form.
 *
 * Built in JS rather than on Android's own date dialog: the system dialog
 * follows the OS's day/night theme, which this app deliberately doesn't
 * control (see DEVELOPMENT.md gotcha 9), so it would open light over a dark
 * theme and carry none of the app's material. This way the calendar is themed,
 * mirrors in Arabic, shows Arabic-Indic digits like every amount, and needs no
 * native dependency or prebuild.
 *
 * Values stay local-calendar YYYY-MM-DD strings end to end, so nothing here
 * can shift a date by a day through UTC (src/lib/dates.ts).
 */
export function DateField({
  value,
  onChange,
  label,
  compact,
  placeholder,
  sheetTitle,
  accessibilityLabel,
  clearable,
  min,
  max,
}: DateFieldProps) {
  const { theme } = useTheme();
  const { t, language, isRTL } = useLanguage();
  const [open, setOpen] = useState(false);
  const [pressed, setPressed] = useState(false);

  const today = todayStr();
  const anchor = isValidDateStr(value) ? value : today;
  const [[viewYear, viewMonth], setView] = useState<[number, number]>(() => {
    const [year, month] = dateParts(anchor);
    return [year, month];
  });

  // Reopening starts on the selected month again, not wherever the user last browsed.
  const openSheet = () => {
    const [year, month] = dateParts(isValidDateStr(value) ? value : todayStr());
    setView([year, month]);
    setOpen(true);
  };

  const weekdays = useMemo(() => weekdayInitials(language), [language]);

  const cells = useMemo(() => {
    const offset = firstWeekdayOfMonth(viewYear, viewMonth);
    const total = daysInMonth(viewYear, viewMonth);
    return Array.from({ length: COLUMNS * ROWS }, (_, index) => {
      const day = index - offset + 1;
      return day >= 1 && day <= total ? day : null;
    });
  }, [viewYear, viewMonth]);

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth - 1 + delta, 1);
    setView([next.getFullYear(), next.getMonth() + 1]);
  };

  const select = (day: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(toDateStr(viewYear, viewMonth, day));
    setOpen(false);
  };

  const outOfRange = (date: string) => (min && date < min) || (max && date > max);

  return (
    <>
      {/* The same anatomy as AmountInput: the label lives inside the box, and
          the thing that opens a sheet is a tinted pill with a chevron — a
          plain glyph at the end of a row reads as decoration, not as a
          control (the lesson AmountInput's currency button already records). */}
      <Pressable
        onPress={openSheet}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: value ? formatDateLong(value, language) : placeholder }}
        // A static style object, not a style function: NativeWind's JSX
        // transform drops function styles on Pressable (DEVELOPMENT.md gotcha 7).
        style={{
          borderRadius: RADII.field,
          padding: 12,
          gap: 2,
          backgroundColor: theme.surfaceAlt,
          borderWidth: 1,
          borderColor: pressed ? withAlpha(theme.accent2, 0.5) : theme.border,
        }}
      >
        {label ? (
          <Text
            style={{
              fontSize: 9.5,
              fontWeight: '700',
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              color: theme.textTertiary,
            }}
          >
            {label}
          </Text>
        ) : null}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginTop: label ? 6 : 0,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              height: 30,
              paddingStart: compact ? 8 : 11,
              paddingEnd: 8,
              borderRadius: RADII.pill,
              borderWidth: 1,
              borderColor: withAlpha(theme.accent2, pressed ? 0.5 : 0.28),
              backgroundColor: withAlpha(theme.accent2, pressed ? 0.24 : 0.13),
            }}
          >
            <CalendarDays size={14} color={theme.accent2} strokeWidth={2.4} />
            <ChevronDown size={13} color={theme.accent2} strokeWidth={2.6} />
          </View>

          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: compact ? 13 : 16,
              fontWeight: '600',
              color: value ? theme.textPrimary : theme.textTertiary,
            }}
          >
            {value
              ? compact
                ? formatDateMedium(value, language)
                : formatDateLong(value, language)
              : placeholder}
          </Text>

          {value === today && !compact ? (
            <Badge label={t('dateField.today')} variant="accent" />
          ) : null}
        </View>
      </Pressable>

      <GlassModal visible={open} onClose={() => setOpen(false)} title={sheetTitle}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <IconButton
            icon={ChevronLeft}
            directional
            variant="surface"
            size={32}
            iconSize={16}
            onPress={() => shiftMonth(isRTL ? 1 : -1)}
            accessibilityLabel={t(isRTL ? 'dateField.nextMonth' : 'dateField.previousMonth')}
          />
          <Text style={{ fontSize: 14, fontWeight: '700', color: theme.textPrimary }}>
            {monthLabel(viewYear, viewMonth, language)}
          </Text>
          <IconButton
            icon={ChevronRight}
            directional
            variant="surface"
            size={32}
            iconSize={16}
            onPress={() => shiftMonth(isRTL ? -1 : 1)}
            accessibilityLabel={t(isRTL ? 'dateField.previousMonth' : 'dateField.nextMonth')}
          />
        </View>

        <View style={{ flexDirection: 'row' }}>
          {weekdays.map((day, index) => (
            <Text
              key={index}
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 10,
                fontWeight: '700',
                color: theme.textTertiary,
              }}
            >
              {day}
            </Text>
          ))}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {cells.map((day, index) => {
            if (day === null) {
              return <View key={index} style={{ width: `${100 / COLUMNS}%`, aspectRatio: 1 }} />;
            }
            const date = toDateStr(viewYear, viewMonth, day);
            const selected = date === value;
            const isToday = date === today;
            const disabled = !!outOfRange(date);
            return (
              <View key={index} style={{ width: `${100 / COLUMNS}%`, aspectRatio: 1, padding: 3 }}>
                <Pressable
                  onPress={() => select(day)}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel={date}
                  accessibilityState={{ selected, disabled }}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: RADII.tileSm,
                    backgroundColor: selected ? theme.accent1 : 'transparent',
                    borderWidth: isToday && !selected ? 1 : 0,
                    borderColor: withAlpha(theme.accent2, 0.6),
                    opacity: disabled ? 0.3 : 1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: selected || isToday ? '700' : '500',
                      color: selected ? theme.buttonText : theme.textPrimary,
                    }}
                  >
                    {formatDayNumber(day, language)}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18 }}>
          <SecondaryButton
            variant="link"
            label={t('dateField.today')}
            disabled={!!outOfRange(today)}
            onPress={() => {
              onChange(today);
              setOpen(false);
            }}
          />
          {clearable ? (
            <SecondaryButton
              variant="link"
              label={t('dateField.clear')}
              onPress={() => {
                onChange('');
                setOpen(false);
              }}
            />
          ) : null}
        </View>
      </GlassModal>
    </>
  );
}
