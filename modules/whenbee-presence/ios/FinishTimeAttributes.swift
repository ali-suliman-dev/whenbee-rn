// FinishTimeAttributes.swift
// Main-app copy of the Live Activity attributes. MUST stay identical in stored-
// property shape to targets/widget/FinishTimeActivity.swift — Activity<FinishTimeAttributes>
// only matches across the app + widget targets when both copies are byte-identical.
import ActivityKit
import Foundation

struct FinishTimeAttributes: ActivityAttributes {
    /// Mutable per-update state. Kept minimal: the countdown is driven by the
    /// immutable `finishDate` via `Text(timerInterval:)`, so the only live
    /// fields are overrun state and the Pro presentation gate.
    public struct ContentState: Codable, Hashable {
        /// True once "now" passes `finishDate` — over your guess is data, not failure
        /// (no red, no guilt: we just shift the copy to "running over").
        var isOverrun: Bool
        /// Whether to render the rich (ring + accents) presentation. Set at activity
        /// start from the entitlement and survives subsequent updates. The live digits
        /// tick free in both modes regardless.
        var isProRich: Bool
    }

    /// Task label shown on the Lock Screen / expanded island.
    var taskLabel: String
    /// Honest finish as Unix seconds; the ring/clock counts down to this.
    var finishEpoch: Double
    /// Unix seconds when the timer started; the ring fills from startEpoch to finishEpoch.
    var startEpoch: Double

    var finishDate: Date { Date(timeIntervalSince1970: finishEpoch) }
    var startDate: Date { Date(timeIntervalSince1970: startEpoch) }
}
