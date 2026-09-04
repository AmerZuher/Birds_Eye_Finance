import React from 'react';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

const GLOW_SIZE = 280;
// How far the circle's *center* sits outside the card corner, as a fraction
// of GLOW_SIZE. Large on purpose: the previous version centered the circle
// close to the corner, so its bright inner half sat inside the card and got
// hard-cut by the card's own rounded clip — that cut edge is what read as an
// ugly solid disc, no matter how the gradient itself was eased. Pushing the
// center this far outside means only the already-faint outer tail of the
// gradient ever crosses into visible space — it reads as light spilling in
// from off-screen, not a shape sitting in the corner.
const CENTER_OFFSET = 0.62;

/** One soft ambient wash in a card corner, built from a single radial
 * gradient with many closely-spaced stops (fine steps avoid the visible
 * banding/rings a 2-3 stop gradient shows on a near-black background) and,
 * critically, positioned so its bright center falls outside the visible
 * area entirely — see CENTER_OFFSET above. Extracted from MoneyStatCard so
 * every hero card shares the exact same glow without copying SVG plumbing. */
export function GlowBlob({ color, corner }: { color: string; corner: 'topStart' | 'bottomEnd' }) {
  const id = `glow-${corner}`;
  const offset = -GLOW_SIZE * CENTER_OFFSET;
  return (
    <Svg
      width={GLOW_SIZE}
      height={GLOW_SIZE}
      style={[
        { position: 'absolute' },
        // Purely decorative ambient lighting, not directional UI — left/right
        // corners rather than RTL start/end (same exception rule 9 already
        // makes for the FAB's fixed position).
        corner === 'topStart' ? { top: offset, left: offset } : null,
        corner === 'bottomEnd' ? { bottom: offset, right: offset } : null,
      ]}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={0.26} />
          <Stop offset="8%" stopColor={color} stopOpacity={0.24} />
          <Stop offset="18%" stopColor={color} stopOpacity={0.19} />
          <Stop offset="30%" stopColor={color} stopOpacity={0.13} />
          <Stop offset="44%" stopColor={color} stopOpacity={0.08} />
          <Stop offset="58%" stopColor={color} stopOpacity={0.045} />
          <Stop offset="72%" stopColor={color} stopOpacity={0.022} />
          <Stop offset="86%" stopColor={color} stopOpacity={0.008} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={GLOW_SIZE / 2} cy={GLOW_SIZE / 2} r={GLOW_SIZE / 2} fill={`url(#${id})`} />
    </Svg>
  );
}
