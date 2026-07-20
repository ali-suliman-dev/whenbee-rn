# Brand source art

`bee-logo.png` — 7200×7200 source for the app icon. Not referenced by any code and
not bundled by Metro; it lives here so the icon can be regenerated.

Everything in `assets/images/` is derived from it:

| Output | Notes |
|---|---|
| `icon.png` | 1024², alpha flattened (iOS rejects icons with an alpha channel) |
| `favicon.png` | 48² |
| `android-icon-background.png` | full artwork — the adaptive-icon **background** layer, because the art is full-bleed and the foreground layer only guarantees the centre 66% survives the launcher mask |
| `android-icon-foreground.png` | transparent |

`splash-icon.png` is **not** derived from this file — it is the mascot lockup built from
`src/assets/illustrations/bee.svg` plus the Plus Jakarta Sans Bold wordmark.
