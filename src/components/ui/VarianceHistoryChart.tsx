import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { MoneyAmount } from '@/components/ui/MoneyAmount';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useTheme } from '@/context/ThemeContext';
import { SEMANTIC } from '@/constants/theme';
import { withAlpha } from '@/utils/color';

export interface VarianceRow {
  key: string | number;
  /** The log's date, already formatted for display. */
  label: string;
  /** The logged balance in base currency. */
  logged: number;
  /** What it was expected to be, aged from the previous log. */
  expected: number;
  /** logged − expected. */
  variance: number;
  /** Text under the bar — the expected figure, already formatted. */
  expectedLabel: string;
}

interface VarianceHistoryChartProps {
  /** Newest first; the caller slices to the rows it wants shown. */
  rows: VarianceRow[];
  /** Rows not shown, rendered as a muted "+n more" caption. */
  moreCount?: number;
  moreLabel?: string;
  /** Makes each row tappable — Analytics uses it to offer deleting that log. */
  onSelectRow?: (row: VarianceRow) => void;
}

/** Actual as a share of expected, with the degenerate cases pinned. */
function fillRatio(logged: number, expected: number): number {
  if (expected > 0) return Math.min(1, Math.max(0, logged / expected));
  return logged > 0 ? 1 : 0;
}

/**
 * Expected-vs-actual across logged balances (FEATURE_SPEC 8.3), built from
 * ProgressBar and MoneyAmount rather than a charting dependency — the app
 * ships no chart library and this needs none (CLAUDE.md rule 4).
 *
 * Each bar is the logged balance as a share of what was expected, capped at
 * full so one large overshoot can't flatten every other row into invisibility;
 * the signed variance beside it carries the real magnitude. Colored by the
 * sign of the variance, not by how full the bar is.
 */
export function VarianceHistoryChart({
  rows,
  moreCount = 0,
  moreLabel,
  onSelectRow,
}: VarianceHistoryChartProps) {
  const { theme } = useTheme();

  return (
    <View style={{ gap: 14 }}>
      {rows.map((row) => {
        const positive = row.variance >= 0;
        const tint = positive ? SEMANTIC.positive : SEMANTIC.negative;
        return (
          <Pressable
            key={row.key}
            onPress={onSelectRow ? () => onSelectRow(row) : undefined}
            disabled={!onSelectRow}
            accessibilityRole={onSelectRow ? 'button' : undefined}
            style={{ gap: 6 }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary }}>
                {row.label}
              </Text>
              <MoneyAmount amount={row.logged} size={15} numberOfLines={1} />
            </View>
            <ProgressBar
              progress={fillRatio(row.logged, row.expected)}
              height={6}
              colors={[withAlpha(tint, 0.55), tint]}
            />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ fontSize: 11, color: theme.textTertiary }}>{row.expectedLabel}</Text>
              <MoneyAmount amount={row.variance} size={12} color={tint} numberOfLines={1} />
            </View>
          </Pressable>
        );
      })}
      {moreCount > 0 && moreLabel ? (
        <Text style={{ fontSize: 11.5, color: theme.textTertiary, textAlign: 'center' }}>
          {moreLabel}
        </Text>
      ) : null}
    </View>
  );
}
