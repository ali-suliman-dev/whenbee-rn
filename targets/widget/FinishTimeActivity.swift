// FinishTimeActivity.swift
//
// ActivityKit Live Activity + Dynamic Island for a running timer's honest
// finish-time ring. Shows on the Lock Screen and in the Dynamic Island while a
// task timer runs, and keeps counting down to the honest finish even with the
// app fully closed — the gap Llama Life reviews complain about (00-MVP §native).
//
// The ATTRIBUTES below are the contract with the app side. The RN bridge starts
// /updates/ends this activity (see src/services/liveActivity.ts). The static
// fields (label, target finish Date) are fixed for the session; ContentState is
// empty here because WidgetKit's `Text(timerInterval:)` renders the live
// countdown itself from the immutable `finishDate` — no per-second push needed.

import ActivityKit
import WidgetKit
import SwiftUI

/// Shared attributes for the running-timer Live Activity.
/// MUST stay in sync with the `attributes` JS writes in liveActivity.ts AND with
/// the main-app copy in modules/whenbee-presence/ios/FinishTimeAttributes.swift —
/// `Activity<FinishTimeAttributes>` only matches across the app + widget targets
/// when both copies are byte-identical in shape.
struct FinishTimeAttributes: ActivityAttributes {
    /// Mutable per-update state. Kept minimal: the countdown is driven by the
    /// immutable `finishDate` via `Text(timerInterval:)`, so the only thing we
    /// flip live is whether the user has run past their honest finish.
    public struct ContentState: Codable, Hashable {
        /// True once "now" passes `finishDate` — over your guess is data, not failure
        /// (no red, no guilt: we just shift the copy to "running over").
        var isOverrun: Bool
    }

    /// Task label shown on the Lock Screen / expanded island.
    var taskLabel: String
    /// Honest finish as Unix seconds; the ring/clock counts down to this.
    var finishEpoch: Double

    var finishDate: Date { Date(timeIntervalSince1970: finishEpoch) }
}

struct FinishTimeActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: FinishTimeAttributes.self) { context in
            // ── Lock Screen / banner presentation ──
            LockScreenFinishView(context: context)
                .padding(14)
                .activityBackgroundTint(Color.black.opacity(0.35))
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded island.
                DynamicIslandExpandedRegion(.leading) {
                    Label(context.attributes.taskLabel, systemImage: "hourglass")
                        .font(.caption.weight(.semibold))
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(timerInterval: Date()...context.attributes.finishDate, countsDown: true)
                        .font(.title3.monospacedDigit())
                        .frame(maxWidth: 64)
                        .multilineTextAlignment(.trailing)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.isOverrun ? "Running over — that's data" : "Honest finish ahead")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            } compactLeading: {
                Image(systemName: "hourglass")
            } compactTrailing: {
                Text(timerInterval: Date()...context.attributes.finishDate, countsDown: true)
                    .monospacedDigit()
                    .frame(maxWidth: 44)
            } minimal: {
                Image(systemName: "hourglass")
            }
            .keylineTint(.yellow)
        }
    }
}

/// Lock-Screen layout for the running-timer activity.
private struct LockScreenFinishView: View {
    let context: ActivityViewContext<FinishTimeAttributes>

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Whenbee")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
                Text(context.attributes.taskLabel)
                    .font(.headline)
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 2) {
                Text(timerInterval: Date()...context.attributes.finishDate, countsDown: true)
                    .font(.title2.monospacedDigit().weight(.semibold))
                    .frame(maxWidth: 90)
                    .multilineTextAlignment(.trailing)
                Text(context.state.isOverrun ? "over" : "to honest finish")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
