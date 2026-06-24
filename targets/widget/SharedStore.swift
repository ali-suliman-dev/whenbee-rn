// SharedStore.swift
//
// Reads the payload the React Native side writes into the shared App Group store
// (see src/services/liveActivity.ts -> writeWidgetSnapshot). One small DTO + one
// loader, kept intentionally dumb: the widget only renders what JS already
// computed (the honest finish time), it never does calibration math itself.
//
// Keep the App Group id and the keys in sync with the JS bridge.

import Foundation

/// Must match `APP_GROUP_ID` in src/services/liveActivity.ts.
let kAppGroupId = "group.com.whenbee.app"

/// Must match `WIDGET_SNAPSHOT_KEY` in src/services/liveActivity.ts.
private let kSnapshotKey = "whenbee.widgetSnapshot"

/// The next-task snapshot the Home-screen widget renders.
/// Mirrors the JS `WidgetSnapshot` shape (see liveActivity.ts).
struct WidgetSnapshot: Codable {
    /// Label of the next task, e.g. "Write the report". Empty when nothing is queued.
    let nextTaskLabel: String
    /// Category id/name for the small caption (e.g. "Deep work").
    let category: String
    /// Honest finish time as a wall-clock string the JS layer already formatted,
    /// e.g. "7:10". JS owns formatting so the widget stays presentation-only.
    let honestFinishClock: String
    /// Deep link the one-tap "Start" button opens, e.g. "whenbee://timer?taskId=123".
    let startDeepLink: String
    /// Unix seconds when JS wrote this — lets the widget show a "stale" fallback.
    let updatedAtEpoch: Double
    /// Unix seconds of the honest finish. Optional so older snapshots still decode.
    /// Drives the ring arc fraction (see `arcFraction`).
    let honestFinishEpoch: Double?
    /// Pro entitlement at write time. The widget renders the rich arc + reclaim
    /// line only when true. Optional/defaulted false for back-compat.
    let isPro: Bool?

    static var placeholder: WidgetSnapshot {
        WidgetSnapshot(
            nextTaskLabel: "Write the report",
            category: "Deep work",
            honestFinishClock: "7:10",
            startDeepLink: "whenbee://timer",
            updatedAtEpoch: Date().timeIntervalSince1970,
            honestFinishEpoch: Date().addingTimeInterval(45 * 60).timeIntervalSince1970,
            isPro: true
        )
    }
}

enum SharedStore {
    /// Seconds after which a snapshot is "stale" and the finish line drops its
    /// confident "Honest finish" prefix. Mirrors kStaleSeconds in the plan.
    static let staleSeconds: Double = 6 * 3600

    /// Fraction [0,1] of the way from `updatedAt` to `finish` at `now`.
    /// Byte-mirror of arcFraction() in src/engine/presence.ts. Negative span → 0,
    /// zero span → 1 (no divide-by-zero), past finish → 1.
    static func arcFraction(updatedAt: Double, finish: Double, now: Double) -> Double {
        let span = finish - updatedAt
        if span < 0 { return 0 }
        if span == 0 { return 1 }
        let elapsed = now - updatedAt
        if elapsed <= 0 { return 0 }
        if elapsed >= span { return 1 }
        return elapsed / span
    }

    /// Loads the latest snapshot JS wrote, or `nil` if none/undecodable.
    static func loadSnapshot() -> WidgetSnapshot? {
        guard
            let defaults = UserDefaults(suiteName: kAppGroupId),
            let raw = defaults.string(forKey: kSnapshotKey),
            let data = raw.data(using: .utf8)
        else { return nil }
        return try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
    }
}
