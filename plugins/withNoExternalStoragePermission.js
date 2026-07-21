const { withAndroidManifest } = require('expo/config-plugins');

/**
 * expo-file-system and expo-image both declare READ/WRITE_EXTERNAL_STORAGE in
 * their library manifests, so the merged app manifest requests them. Whenbee
 * never touches shared/external storage — PDF report export and view-shot write
 * to the app-internal cache/documents dirs (minSdk 24, scoped storage), which
 * need no storage permission. A broad, unused storage permission draws Play
 * policy scrutiny and (READ_EXTERNAL_STORAGE) can force a data-safety
 * declaration, so we strip both.
 *
 * We don't hand-edit the merged manifest (it's CNG/regenerated). Instead we add
 * uses-permission entries carrying tools:node="remove" — the Android manifest
 * merger honours this to delete a permission a dependency injected, which is the
 * merger-safe way to drop a library-declared permission.
 *
 * Note: SYSTEM_ALERT_WINDOW is intentionally NOT touched here — it originates
 * only from react-native's debug manifest (the dev red-box overlay) and never
 * ships in a release/production build, so there is nothing to remove.
 */
const REMOVED_PERMISSIONS = [
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
];

const withNoExternalStoragePermission = (config) =>
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

module.exports = withNoExternalStoragePermission;
