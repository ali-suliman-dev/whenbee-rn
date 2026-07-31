const { withInfoPlist } = require('expo/config-plugins');

/**
 * Whenbee reads and writes calendar EVENTS only (Calendar.EntityTypes.EVENT in
 * src/services/calendar.ts) — it never touches Reminders. The expo-calendar
 * config plugin unconditionally injects the Reminders usage strings, and an
 * unused permission string with boilerplate copy is an App Store metadata /
 * Play policy rejection risk. This plugin runs after expo-calendar and deletes
 * the Reminders keys so only the Calendars strings ship.
 *
 * (Android READ_CALENDAR / WRITE_CALENDAR are genuinely used, so they stay.)
 */
const withNoRemindersPermission = (config) =>
  withInfoPlist(config, (cfg) => {
    delete cfg.modResults.NSRemindersUsageDescription;
    delete cfg.modResults.NSRemindersFullAccessUsageDescription;
    return cfg;
  });

module.exports = withNoRemindersPermission;
