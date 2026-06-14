import Svg, { Path, Rect } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';

// ──────────────────────────────────────────────────────────────────────────────
// BeeMascot — the brand Whenbee, a hand-authored react-native-svg translation of
// website-2.0/assets/bee.svg (source kept at src/assets/illustrations/bee.svg).
// Same approach as WhenbeeAvatar's SVG — no svg-transformer dependency.
//
// One STATIC artwork at every tier: progression is told by the honeycomb + tier
// trail, not the bee. The `variant` prop is the extension seam — future tier or
// seasonal artworks slot in here without touching call sites (the user has more
// art coming). Today every variant renders the default bee.
//
// Colors are token-sourced from `brand.bee` (fixed, mode-independent — a mascot
// reads as the same bee in light and dark, like a logo).
// ──────────────────────────────────────────────────────────────────────────────

export type BeeVariant = 'default';

export function BeeMascot({
  size = 88,
  variant = 'default',
}: {
  size?: number;
  variant?: BeeVariant;
}) {
  const t = useTheme();
  const c = t.brand.bee;

  // Switch on variant so future artworks slot in here. `variant` is read so the
  // prop is wired end-to-end today even though there's a single artwork.
  void variant;

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 2400 2400"
      accessibilityRole="image"
      accessibilityLabel="Your Whenbee companion"
    >
      {/* Stinger (behind the body) */}
      <Rect x={1100} y={1700} width={200} height={200} rx={80} fill={c.ink} />

      {/* Right antenna (rotation via originX/originY props — the proven RN-SVG path) */}
      <Rect x={1320.26} y={426.085} width={50} height={200} rotation={15} originX={1320.26} originY={426.085} fill={c.antenna} />
      <Rect x={1309.06} y={371.318} width={100} height={100} rx={40} rotation={15} originX={1309.06} originY={371.318} fill={c.antenna} />
      <Path
        d="M1328.34 395.912C1329.77 390.578 1335.25 387.412 1340.59 388.841L1371.59 397.148C1376.92 398.577 1380.09 404.06 1378.66 409.395C1377.23 414.729 1371.75 417.895 1366.41 416.466L1335.41 408.16C1330.08 406.73 1326.91 401.247 1328.34 395.912Z"
        fill={c.antennaHi}
      />

      {/* Left antenna */}
      <Rect x={1031.44} y={439.025} width={50} height={200} rotation={-15} originX={1031.44} originY={439.025} fill={c.antenna} />
      <Rect x={994.352} y={397.201} width={100} height={100} rx={40} rotation={-15} originX={994.352} originY={397.201} fill={c.antenna} />
      <Path
        d="M1058.41 389.803C1063.75 388.374 1069.23 391.54 1070.66 396.874C1072.09 402.209 1068.92 407.692 1063.59 409.121L1033.59 417.16C1028.25 418.589 1022.77 415.424 1021.34 410.089C1019.91 404.755 1023.08 399.271 1028.41 397.841L1058.41 389.803Z"
        fill={c.antennaHi}
      />

      {/* Wings (behind the body) */}
      <Path
        d="M1310 1195.19C1310 1080.48 1388.07 980.481 1499.37 952.658L1799.37 877.658C1957.15 838.212 2110 957.551 2110 1120.19V1279.81C2110 1442.45 1957.15 1561.79 1799.37 1522.34L1499.37 1447.34C1388.07 1419.52 1310 1319.52 1310 1204.81V1195.19Z"
        fill={c.wing}
      />
      <Path
        d="M290 1120.19C290 957.551 442.847 838.212 600.634 877.658L900.634 952.658C1011.93 980.481 1090 1081.46 1090 1196.18C1090 1309.81 1013.38 1410.11 903.475 1438.96L603.474 1517.71C444.989 1559.32 290 1439.76 290 1275.91V1120.19Z"
        fill={c.wing}
      />

      {/* Body */}
      <Path
        d="M690 1000C690 751.472 891.472 550 1140 550H1260C1508.53 550 1710 751.472 1710 1000V1340C1710 1621.67 1481.67 1850 1200 1850V1850C918.335 1850 690 1621.67 690 1340V1000Z"
        fill={c.body}
      />
      {/* Body top highlight */}
      <Path
        d="M1200 593C1265.78 593 1312.52 593.502 1375.85 614.444C1388.96 618.78 1396.07 632.921 1391.74 646.029C1387.4 659.138 1373.26 666.251 1360.15 661.916C1305.08 643.704 1265.4 643 1200 643C1134.6 643 1094.92 643.704 1039.85 661.916C1026.74 666.251 1012.6 659.138 1008.26 646.029C1003.93 632.921 1011.04 618.78 1024.15 614.444C1087.48 593.502 1134.22 593 1200 593Z"
        fill={c.bodyHi}
      />
      {/* Body bottom shade */}
      <Path
        d="M1710 1340C1710 1621.67 1481.67 1850 1200 1850C918.335 1850 690 1621.67 690 1340V1265C690 1546.67 918.335 1775 1200 1775C1481.67 1775 1710 1546.67 1710 1265V1340Z"
        fill={c.bodyLo}
      />

      {/* Amber stripes */}
      <Path d="M1710 1340C1710 1374.23 1706.63 1407.66 1700.2 1440H699.802C693.373 1407.66 690 1374.23 690 1340V1300H1710V1340Z" fill={c.stripe} />
      <Path d="M1669.29 1540C1647.27 1591.59 1617 1638.81 1580.13 1680H819.863C782.995 1638.81 752.725 1591.59 730.711 1540H1669.29Z" fill={c.stripe} />

      {/* Head band + shadow */}
      <Path
        d="M1350 697C1484.72 697 1594.55 803.565 1599.8 937H1600V980C1600 1101.5 1501.5 1200 1380 1200H1020C898.497 1200 800 1101.5 800 980V937H800.197C805.446 803.565 915.278 697 1050 697C1106.28 697 1158.22 715.598 1200 746.982C1241.78 715.598 1293.72 697 1350 697Z"
        fill={c.stripe}
      />
      <Path
        d="M1599.25 927.505C1599.49 930.654 1599.68 933.819 1599.8 937H1600V980C1600 1101.5 1501.5 1200 1380 1200H1020C898.497 1200 800 1101.5 800 980V937H800.197C800.322 933.819 800.506 930.654 800.749 927.505C810.7 1056.46 918.493 1158 1050 1158H1350C1481.51 1158 1589.3 1056.46 1599.25 927.505Z"
        fill={c.stripeLo}
      />

      {/* Eyes + smile */}
      <Rect x={1355} y={887} width={50} height={100} rx={25} fill={c.ink} />
      <Path
        d="M1245.64 1084.39C1253.16 1083.14 1260 1088.94 1260 1096.55C1260 1102.58 1255.64 1107.73 1249.7 1108.72L1241.5 1110.08C1214.02 1114.66 1185.98 1114.66 1158.5 1110.08L1150.3 1108.72C1144.36 1107.73 1140 1102.58 1140 1096.55C1140 1088.94 1146.84 1083.14 1154.36 1084.39L1162.99 1085.83C1187.5 1089.92 1212.5 1089.92 1237.01 1085.83L1245.64 1084.39Z"
        fill={c.ink}
      />
      <Rect x={995} y={887} width={50} height={100} rx={25} fill={c.ink} />
    </Svg>
  );
}
