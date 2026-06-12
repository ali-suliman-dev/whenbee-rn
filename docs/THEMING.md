# Theming

## The one file to edit

**`src/theme/tokens.ts`** is the single source of truth for the app's visual style. Changing a value here propagates instantly to every primitive that reads it.

## Token structure

```ts
// src/theme/tokens.ts
{
  colors: {
    light: { bg, surface, text, textMuted, primary, primaryText, accent, success, danger, border },
    dark:  { bg, surface, text, textMuted, primary, primaryText, accent, success, danger, border },
  },
  space:       // spacing scale (RN points)
  radii:       // border-radius scale
  fontSize:    // type scale
  fontWeight:  // weight tokens
  fontFamily:  // family tokens
  lineHeight:  // line-height tokens
  shadow:      // shadow tokens
  motion:      // duration / easing tokens
}
```

The `light` and `dark` color sets share identical keys, so switching modes never breaks a component.

## How primitives consume tokens

```ts
const theme = useTheme();   // returns the resolved token set for the current color mode
// use theme.colors.bg, theme.space[4], etc. in style props
```

`useTheme()` is available everywhere. All app primitives (`Screen`, `AppText`, `AppButton`, `Card`, `Chip`) use it exclusively — no hardcoded colors or spacing values.

## Color mode

- **Store:** `settingsStore.colorMode` — values: `system` | `light` | `dark`, persisted to the KV store.
- **Hook:** `useColorMode()` reads the active resolved mode (`light` or `dark`).
- **Switching live:** the Settings screen writes to `settingsStore`, which is wired to gluestack's provider `mode` in `AppProviders`. The whole UI re-renders instantly.

## Two theming surfaces

There are intentionally two independent theming surfaces in this project:

| Surface | Controlled by | Used by |
|---|---|---|
| App tokens | `src/theme/tokens.ts` | App primitives and screens |
| gluestack config | `components/ui/gluestack-ui-provider/config.ts` + `tailwind.config.js` | gluestack-ui v3 components |

Tailwind's default scales were **not** overridden to avoid breaking gluestack-ui. To restyle your app's own surfaces, edit `src/theme/tokens.ts`. To restyle gluestack components, edit their provider config.

## Quick-start: reskinning the app

1. Open `src/theme/tokens.ts`.
2. Update `colors.light` and `colors.dark` with your brand palette.
3. Adjust `fontSize`, `space`, and `radii` to taste.
4. Done — all primitives and screens update automatically.

To also restyle gluestack components (buttons, inputs, etc. from `components/ui/`), update `components/ui/gluestack-ui-provider/config.ts` and `tailwind.config.js` accordingly.
