/**
 * Widget extension target config for @bacons/apple-targets.
 *
 * Houses BOTH the static Home-screen WidgetKit widget AND the ActivityKit Live
 * Activity / Dynamic Island. On iOS a Live Activity is not a standalone target —
 * it ships inside a WidgetKit extension's `WidgetBundle`, so one extension target
 * is the correct architecture (see WhenbeeWidgetBundle.swift).
 *
 * The App Group is mirrored from app.json's
 * `ios.entitlements['com.apple.security.application-groups']` so the widget and
 * the main app read/write the same shared store. Keep the id in ONE place
 * (app.json) — this file just forwards it.
 *
 * ESM/TypeScript are not supported here by the plugin — CommonJS `require` only.
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
  type: 'widget',
  name: 'WhenbeeWidget',
  displayName: 'Whenbee',
  // Pull SwiftUI + ActivityKit (Live Activity / Dynamic Island) + WidgetKit.
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit'],
  // Live Activities need iOS 16.1+; Dynamic Island arrived with the iPhone 14 Pro.
  deploymentTarget: '16.2',
  entitlements: {
    // Share the SAME App Group the main app declares so the JS bridge and the
    // widget see one shared payload. Falls back to the literal group id if the
    // app config hasn't declared it yet (keeps prebuild from throwing).
    'com.apple.security.application-groups':
      config.ios?.entitlements?.['com.apple.security.application-groups'] ?? [
        'group.com.whenbee.app',
      ],
  },
});
