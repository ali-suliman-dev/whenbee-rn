// Icon stand-ins that render a queryable host element carrying the glyph name.
//
// These live in their own module because a `jest.mock()` factory may not touch
// out-of-scope variables, and nativewind's babel transform injects one
// (`_ReactNativeCSSInterop`) into any component defined inside such a factory.
// A factory that only does `require('./helpers/iconProbes')` sidesteps that.
import { createElement } from 'react';

/** Replaces `@expo/vector-icons` — probes render as `ionicon-<name>`. */
export const vectorIconsProbe = {
  Ionicons: ({ name }: { name: string }) =>
    createElement('icon-probe', { testID: `ionicon-${name}` }),
};

/** Replaces `expo-symbols` — probes render as `sf-<name>`. */
export const symbolsProbe = {
  SymbolView: ({ name }: { name: string }) =>
    createElement('icon-probe', { testID: `sf-${name}` }),
};
