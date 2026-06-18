import Svg, { Circle, Ellipse, Defs, RadialGradient, Stop } from 'react-native-svg';

// ──────────────────────────────────────────────────────────────────────────────
// BeeCoin — the backing coin behind a BeeMascot. Two looks, one component:
//
//   • soft (default) — a neutral disc at full tone out to `core`, then a feathered
//     rim that fades to transparent: a CIRCLE WITH SOFT EDGES (not a glow). Lifts the
//     bee off whatever sits behind it (the page bg in the hub ring, the dark HUD card).
//   • solid — a hard-edged disc with NO feather, lifted off the surface by a soft
//     contact shadow (`shadowColor`). Used by the light HUD row, where a feathered
//     white coin melts into the white card: the solid periwinkle disc + shadow reads
//     as a deliberate medallion the bee sits on.
//
// Mount it absolutely-positioned behind a centered BeeMascot. Colour from a token
// (`colors.companionCoin` / `colors.companionCoinHud`).
//
// `core` (0–1, soft only) = how far the solid centre holds before the rim feathers.
// Higher = sharper. The hub ring frames its coin (wide rim ok); the ringless HUD coin
// needs a high core or it reads as a glow.
// ──────────────────────────────────────────────────────────────────────────────

interface BeeCoinProps {
  size: number;
  color: string;
  /** Soft-rim feather extent (0–1). Ignored when `solid`. */
  core?: number;
  /** Render a hard-edged disc instead of a feathered one. */
  solid?: boolean;
  /** When set, paints a soft contact shadow under the disc so it lifts off the surface. */
  shadowColor?: string;
}

export function BeeCoin({ size, color, core = 0.58, solid = false, shadowColor }: BeeCoinProps) {
  const r = size / 2;
  // Stable, size-independent gradient ids (multiple coins can coexist on a screen).
  const id = `beeCoin-${Math.round(size)}`;
  const shadowId = `beeCoinShadow-${Math.round(size)}`;
  // A solid disc is inset so the contact shadow has room to bloom within the box.
  const discR = solid ? r - size * 0.085 : r;

  return (
    <Svg width={size} height={size} style={{ position: 'absolute' }} pointerEvents="none">
      <Defs>
        {shadowColor ? (
          <RadialGradient id={shadowId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={shadowColor} stopOpacity={0.2} />
            <Stop offset="62%" stopColor={shadowColor} stopOpacity={0.12} />
            <Stop offset="100%" stopColor={shadowColor} stopOpacity={0} />
          </RadialGradient>
        ) : null}
        {!solid ? (
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={1} />
            <Stop offset={`${Math.round(core * 100)}%`} stopColor={color} stopOpacity={1} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        ) : null}
      </Defs>
      {shadowColor ? (
        <Ellipse
          cx={r}
          cy={r + size * 0.05}
          rx={r - size * 0.02}
          ry={r - size * 0.03}
          fill={`url(#${shadowId})`}
        />
      ) : null}
      <Circle cx={r} cy={r} r={discR} fill={solid ? color : `url(#${id})`} />
    </Svg>
  );
}
