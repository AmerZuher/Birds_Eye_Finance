export type FontScaleId = 'small' | 'normal' | 'large' | 'xlarge';

export const FONT_SCALE_IDS: FontScaleId[] = ['small', 'normal', 'large', 'xlarge'];

export const FONT_SCALE_MULTIPLIERS: Record<FontScaleId, number> = {
  small: 0.9,
  normal: 1,
  large: 1.12,
  xlarge: 1.28,
};

export const FONT_SCALE_LABELS: Record<FontScaleId, string> = {
  small: 'S',
  normal: 'N',
  large: 'L',
  xlarge: 'XL',
};

export const DEFAULT_FONT_SCALE: FontScaleId = 'normal';
