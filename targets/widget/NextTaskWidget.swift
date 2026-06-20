// NextTaskWidget.swift
//
// The static Home-screen WidgetKit widget. Shows the next task + its honest
// finish time + a one-tap "Start" deep link, plus minimal Whenbee presence.
// Presentation-only: it renders the snapshot the RN bridge wrote into the App
// Group; it never computes the honest number itself.

import WidgetKit
import SwiftUI

/// One timeline entry = one render of the next-task snapshot.
struct NextTaskEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot
}

/// Feeds the widget. Reads the App Group snapshot; falls back to placeholder
/// sample data when nothing has been written yet (fresh install, Expo Go, etc.).
struct NextTaskProvider: TimelineProvider {
    func placeholder(in context: Context) -> NextTaskEntry {
        NextTaskEntry(date: Date(), snapshot: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (NextTaskEntry) -> Void) {
        completion(NextTaskEntry(date: Date(), snapshot: SharedStore.loadSnapshot() ?? .placeholder))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NextTaskEntry>) -> Void) {
        let entry = NextTaskEntry(date: Date(), snapshot: SharedStore.loadSnapshot() ?? .placeholder)
        // Refresh hourly; the RN bridge also pokes WidgetCenter on every write so
        // the widget updates promptly when a new task becomes "next".
        let next = Calendar.current.date(byAdding: .hour, value: 1, to: Date()) ?? Date()
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct NextTaskWidgetView: View {
    var entry: NextTaskEntry
    @Environment(\.widgetFamily) var family

    private var hasTask: Bool { !entry.snapshot.nextTaskLabel.isEmpty }
    private var isPro: Bool { entry.snapshot.isPro ?? false }

    // MARK: – Stale-aware finish line

    private var isStale: Bool {
        Date().timeIntervalSince1970 - entry.snapshot.updatedAtEpoch > SharedStore.staleSeconds
    }

    private var finishLine: String {
        isStale ? entry.snapshot.honestFinishClock
                : "Honest finish \(entry.snapshot.honestFinishClock)"
    }

    // MARK: – Medium ring

    private var arc: Double {
        guard let finish = entry.snapshot.honestFinishEpoch else { return 0 }
        return SharedStore.arcFraction(
            updatedAt: entry.snapshot.updatedAtEpoch,
            finish: finish,
            now: Date().timeIntervalSince1970
        )
    }

    private var ring: some View {
        ZStack {
            Circle()
                .stroke(Color("WBRingTrack"), lineWidth: 4)
            if isPro {
                Circle()
                    .trim(from: 0, to: arc)
                    .stroke(Color("WBAccent"), style: StrokeStyle(lineWidth: 4, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            } else {
                // Free: a quiet dot at 12-o'clock on the track — no filled arc.
                Circle()
                    .fill(Color("WBRingTrack"))
                    .frame(width: 6, height: 6)
                    .offset(y: -28)
            }
            Text(entry.snapshot.honestFinishClock)
                .font(.headline)
                .foregroundStyle(Color("WBInk"))
        }
        .frame(width: 56, height: 56)
    }

    // MARK: – Task block (shared between small + medium left column)

    @ViewBuilder
    private var taskBlock: some View {
        if hasTask {
            Text(entry.snapshot.nextTaskLabel)
                .font(.headline)
                .foregroundStyle(Color("WBInk"))
                .lineLimit(2)
            Text(finishLine)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(isStale ? Color("WBInkSoft") : Color("WBAccent"))
            Link(destination: URL(string: entry.snapshot.startDeepLink) ?? URL(string: "whenbee://")!) {
                Text("Start")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 5)
                    .background(Color("WBPrimary"), in: Capsule())
            }
            .padding(.top, 2)
        } else {
            // No-task state — quiet, never guilt-y (product invariant).
            Text("Nothing queued")
                .font(.headline)
                .foregroundStyle(Color("WBInk"))
            Text("Add a task to see its honest finish")
                .font(.caption)
                .foregroundStyle(Color("WBInkSoft"))
        }
    }

    var body: some View {
        if family == .systemMedium {
            // Medium: two-column layout — task block left, ring right.
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    // Minimal Whenbee presence: wordmark + honey dot.
                    HStack(spacing: 4) {
                        Circle()
                            .fill(Color("WBPrimary"))
                            .frame(width: 7, height: 7)
                        Text("Whenbee")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(Color("WBInkSoft"))
                    }
                    Spacer(minLength: 0)
                    taskBlock
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)

                VStack {
                    Spacer(minLength: 0)
                    ring
                    Spacer(minLength: 0)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .padding(14)
        } else {
            // Small: single-column layout (original).
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 4) {
                    Circle()
                        .fill(Color("WBPrimary"))
                        .frame(width: 7, height: 7)
                    Text("Whenbee")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(Color("WBInkSoft"))
                }
                Spacer(minLength: 0)
                taskBlock
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .padding(14)
        }
    }
}

private extension View {
    /// `containerBackground(_:for:)` is iOS 17+ in app extensions. The widget
    /// target deploys to 16.2 (Live Activities need 16.1+), so guard it: 17+
    /// gets the explicit container background, 16 falls back to the system
    /// default that pre-17 widgets used automatically.
    @ViewBuilder
    func widgetBackground() -> some View {
        if #available(iOS 17.0, *) {
            containerBackground(.background, for: .widget)
        } else {
            self
        }
    }
}

struct NextTaskWidget: Widget {
    let kind = "WhenbeeNextTaskWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NextTaskProvider()) { entry in
            NextTaskWidgetView(entry: entry)
                .widgetBackground()
        }
        .configurationDisplayName("Next task")
        .description("Your next task and its honest finish time.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

#if DEBUG
#Preview("Small · task", as: .systemSmall) {
    NextTaskWidget()
} timeline: {
    NextTaskEntry(date: .now, snapshot: .placeholder)
}

#Preview("Medium · Pro ring", as: .systemMedium) {
    NextTaskWidget()
} timeline: {
    NextTaskEntry(date: .now, snapshot: .placeholder)
}
#endif
