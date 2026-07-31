const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Removes Android permissions that dependencies inject into the merged manifest
 * but Whenbee never uses. An unused permission on the Play listing draws policy
 * scrutiny and can force a Data Safety declaration, so we strip the ones the app
 * has no code path for. Verified against the built AAB manifest — not assumed.
 *
 *  - READ/WRITE_EXTERNAL_STORAGE — declared by expo-file-system and expo-image.
 *    The app only writes to app-internal cache/documents dirs (PDF export,
 *    view-shot) at minSdk 24 scoped storage, which needs no storage permission.
 *  - SYSTEM_ALERT_WINDOW — pulled in transitively (react-native's debug manifest
 *    is its only declared source, yet it reached the release AAB). Whenbee has
 *    no "draw over other apps" / overlay code; the Android presence timer is a
 *    promoted notification, not a window overlay. Modern RN LogBox renders
 *    in-app, so debug builds don't need it either.
 *
 * We don't hand-edit the merged manifest (it's CNG/regenerated). Adding
 * uses-permission entries with tools:node="remove" is the merger-safe way to
 * delete a permission a dependency declared, applied against every merged
 * library manifest.
 */
const REMOVED_PERMISSIONS = [
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.SYSTEM_ALERT_WINDOW',
];

const withStripUnusedAndroidPermissions = (config) =>
  withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    // Ensure the tools namespace exists so tools:node resolves.
    manifest.$ = manifest.$ || {};
    manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] || 'http://schemas.android.com/tools';

    const usesPermissions = manifest['uses-permission'] || [];

    for (const name of REMOVED_PERMISSIONS) {
      // Drop any existing grant of this permission so our remove-node is the
      // only entry the merger sees for it.
      const kept = usesPermissions.filter(
        (perm) => perm.$?.['android:name'] !== name,
      );
      kept.push({ $: { 'android:name': name, 'tools:node': 'remove' } });
      usesPermissions.length = 0;
      usesPermissions.push(...kept);
    }

    manifest['uses-permission'] = usesPermissions;
    return cfg;
  });

module.exports = withStripUnusedAndroidPermissions;
