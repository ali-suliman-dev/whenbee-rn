# Whenbee

A near-zero-friction iOS app for time optimists. Guess a duration, run a one-tap timer, and Whenbee learns your personal per-category bias — then shows you an honest number wherever you plan. Built on Expo SDK 54.

- **Wedge:** calibration (it learns *your* real durations).
- **Pro feature:** Honest-Day calendar padding.
- **Invariants:** no guilt ever (amber never red, no streaks), honey is monotonic, on-device-only core loop, pricing read from RevenueCat.

Scaffolded from [`rn-app-template`](https://github.com/ali-suliman-dev/rn-app-template) (Expo SDK 54 · gluestack-ui v3 · NativeWind · Zustand · expo-sqlite · PostHog · Sentry · RevenueCat).

## Scripts

```bash
npm start            # expo start
npm run typecheck    # tsc --noEmit
npm run lint         # eslint . --max-warnings=0
npm test             # jest
npx expo-doctor      # dependency health (expect 18/18)
```

See `docs/superpowers/plans/` for the phased build plan.
