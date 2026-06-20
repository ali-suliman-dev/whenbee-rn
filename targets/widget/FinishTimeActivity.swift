// FinishTimeActivity.swift
//
// ActivityKit Live Activity + Dynamic Island for a running timer's honest
// finish-time ring. Shows on the Lock Screen and in the Dynamic Island while a
// task timer runs, and keeps counting down to the honest finish even with the
// app fully closed — the gap Llama Life reviews complain about (00-MVP §native).
//
// The ATTRIBUTES below are the contract with the app side. The RN bridge starts
// /updates/ends this activity (see src/services/liveActivity.ts). The static
// fields (label, target finish Date) are fixed for the session; ContentState
// carries `isOverrun` (flipped when now > finishDate) and `isProRich` (set once
// at launch from the entitlement — survives updates; the live digits are free for
// all users regardless).

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

    var finishDate: Date { Date(timeIntervalSince1970: finishEpoch) }
}

// MARK: – At-publish arc fraction helpers

/// Returns the arc fraction [0, 1] for the Live Activity ring at the moment the
/// view renders.
///
/// ActivityKit constraint: the arc is static-at-publish — it does not animate
/// per-second. The digits carry per-second truth via `Text(timerInterval:)`.
/// Arc steps only when `ContentState` is pushed from the app (typically every
/// few minutes or on overrun).
///
/// Assumption: there is no explicit "start epoch" in the attributes, so we
/// derive elapsed by comparing `now` against `finishEpoch`. To avoid computing
/// from scratch we assume the task window equals `finishEpoch - updatedAtEpoch`
/// where "updatedAt" is effectively the time this view body re-executes.
/// In practice this means the arc reflects the progress between when the
/// ContentState was last pushed and `finishEpoch`. This is the simplest
/// faithful interpretation of the data available in the Activity attributes.
private func activityArcFraction(finishEpoch: Double, sessionDurationSeconds: Double) -> Double {
    let now = Date().timeIntervalSince1970
    let remaining = finishEpoch - now
    if remaining <= 0 { return 1 }
    if sessionDurationSeconds <= 0 { return 0 }
    let elapsed = sessionDurationSeconds - remaining
    if elapsed <= 0 { return 0 }
    return min(max(elapsed / sessionDurationSeconds, 0), 1)
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
                        .foregroundStyle(context.state.isProRich ? Color("WBAccent") : .primary)
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if context.state.isProRich {
                        // Pro: 36pt ring with live countdown inside.
                        IslandRingView(
                            finishEpoch: context.attributes.finishEpoch,
                            isOverrun: context.state.isOverrun,
                            size: 36,
                            strokeWidth: 3
                        )
                    } else {
                        // Free: plain countdown text.
                        Text(timerInterval: Date()...context.attributes.finishDate, countsDown: !context.state.isOverrun)
                            .font(.title3.monospacedDigit())
                            .frame(maxWidth: 64)
                            .multilineTextAlignment(.trailing)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.isOverrun
                         ? "Running over, and that's just data"
                         : "Honest finish ahead")
                        .font(.caption2)
                        .foregroundStyle(Color("WBInkSoft"))
                }
            } compactLeading: {
                Image(systemName: "hourglass")
                    .foregroundStyle(context.state.isProRich ? Color("WBAccent") : .primary)
            } compactTrailing: {
                // Live digits stay free for all users.
                Text(timerInterval: Date()...context.attributes.finishDate, countsDown: !context.state.isOverrun)
                    .monospacedDigit()
                    .frame(maxWidth: 44)
            } minimal: {
                Image(systemName: "hourglass")
                    .foregroundStyle(context.state.isProRich ? Color("WBAccent") : .primary)
            }
            .keylineTint(
                context.state.isOverrun && context.state.isProRich
                    ? Color("WBAccentEdge")
                    : context.state.isProRich
                        ? Color("WBAccent")
                        : nil  // Free: system default keyline
            )
        }
    }
}

// MARK: – Lock-Screen layout

/// Lock-Screen layout for the running-timer activity.
private struct LockScreenFinishView: View {
    let context: ActivityViewContext<FinishTimeAttributes>

    var body: some View {
        HStack(spacing: 12) {
            // Left: Whenbee tag + task label
            VStack(alignment: .leading, spacing: 2) {
                Text("Whenbee")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(Color("WBInkSoft"))
                Text(context.attributes.taskLabel)
                    .font(.headline)
                    .foregroundStyle(Color("WBInk"))
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            // Right: Pro ring or free plain countdown
            if context.state.isProRich {
                ProLockRingView(
                    finishEpoch: context.attributes.finishEpoch,
                    isOverrun: context.state.isOverrun,
                    finishDate: context.attributes.finishDate
                )
            } else {
                // Free: keep existing plain right-aligned countdown exactly.
                VStack(alignment: .trailing, spacing: 2) {
                    Text(timerInterval: Date()...context.attributes.finishDate, countsDown: true)
                        .font(.title2.monospacedDigit().weight(.semibold))
                        .frame(maxWidth: 90)
                        .multilineTextAlignment(.trailing)
                    Text(context.state.isOverrun ? "over" : "to honest finish")
                        .font(.caption2)
                        .foregroundStyle(Color("WBInkSoft"))
                }
            }
        }
    }
}

// MARK: – Pro ring on Lock Screen (44pt)

private struct ProLockRingView: View {
    let finishEpoch: Double
    let isOverrun: Bool
    let finishDate: Date

    /// Assume a default 30-minute task window for at-publish arc if we have no
    /// explicit session start. This is a reasonable default; the arc steps forward
    /// each time ContentState is pushed from the app side.
    private let assumedSessionDuration: Double = 30 * 60

    private var arc: Double {
        activityArcFraction(finishEpoch: finishEpoch, sessionDurationSeconds: assumedSessionDuration)
    }

    private var ringColor: Color {
        isOverrun ? Color("WBAccentEdge") : Color("WBAccent")
    }

    var body: some View {
        ZStack {
            // Track
            Circle()
                .stroke(Color("WBRingTrack"), lineWidth: 3.5)
            // Fill arc (static-at-publish, steps on ContentState updates)
            Circle()
                .trim(from: 0, to: isOverrun ? 1.0 : arc)
                .stroke(ringColor, style: StrokeStyle(lineWidth: 3.5, lineCap: .round))
                .rotationEffect(.degrees(-90))
            // Live countdown inside the ring
            VStack(spacing: 0) {
                Text(timerInterval: Date()...finishDate, countsDown: !isOverrun)
                    .font(.title2.monospacedDigit().weight(.semibold))
                    .foregroundStyle(Color("WBInk"))
                    .minimumScaleFactor(0.6)
                    .multilineTextAlignment(.center)
                Text(isOverrun ? "over" : "to honest finish")
                    .font(.system(size: 7, weight: .medium))
                    .foregroundStyle(Color("WBInkSoft"))
                    .multilineTextAlignment(.center)
            }
            .padding(6)
        }
        .frame(width: 44, height: 44)
    }
}

// MARK: – Pro ring for Dynamic Island expanded trailing (36pt)

private struct IslandRingView: View {
    let finishEpoch: Double
    let isOverrun: Bool
    let size: CGFloat
    let strokeWidth: CGFloat

    private let assumedSessionDuration: Double = 30 * 60

    private var arc: Double {
        activityArcFraction(finishEpoch: finishEpoch, sessionDurationSeconds: assumedSessionDuration)
    }

    private var ringColor: Color {
        isOverrun ? Color("WBAccentEdge") : Color("WBAccent")
    }

    private var finishDate: Date { Date(timeIntervalSince1970: finishEpoch) }

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color("WBRingTrack"), lineWidth: strokeWidth)
            Circle()
                .trim(from: 0, to: isOverrun ? 1.0 : arc)
                .stroke(ringColor, style: StrokeStyle(lineWidth: strokeWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text(timerInterval: Date()...finishDate, countsDown: !isOverrun)
                .font(.system(size: 9, weight: .semibold).monospacedDigit())
                .foregroundStyle(Color("WBInk"))
                .minimumScaleFactor(0.5)
                .multilineTextAlignment(.center)
                .padding(4)
        }
        .frame(width: size, height: size)
    }
}

// MARK: – Previews

#if DEBUG
extension FinishTimeAttributes {
    static var preview: FinishTimeAttributes {
        FinishTimeAttributes(
            taskLabel: "Write the report",
            finishEpoch: Date().addingTimeInterval(20 * 60).timeIntervalSince1970
        )
    }
}

#Preview("Lock Screen · Pro on-track", as: .content, using: FinishTimeAttributes.preview) {
    FinishTimeActivityWidget()
} contentStates: {
    FinishTimeAttributes.ContentState(isOverrun: false, isProRich: true)
}

#Preview("Lock Screen · Pro overrun", as: .content, using: FinishTimeAttributes.preview) {
    FinishTimeActivityWidget()
} contentStates: {
    FinishTimeAttributes.ContentState(isOverrun: true, isProRich: true)
}

#Preview("Lock Screen · Free", as: .content, using: FinishTimeAttributes.preview) {
    FinishTimeActivityWidget()
} contentStates: {
    FinishTimeAttributes.ContentState(isOverrun: false, isProRich: false)
}
#endif
