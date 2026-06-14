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

    private var hasTask: Bool { !entry.snapshot.nextTaskLabel.isEmpty }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Minimal Whenbee presence: wordmark + the honey dot.
            HStack(spacing: 4) {
                Circle()
                    .fill(.tint)
                    .frame(width: 7, height: 7)
                Text("Whenbee")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 0)

            if hasTask {
                Text(entry.snapshot.nextTaskLabel)
                    .font(.headline)
                    .lineLimit(2)
                Text("Honest finish \(entry.snapshot.honestFinishClock)")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.tint)
                // One-tap start: opens the timer for this task via deep link.
                Link(destination: URL(string: entry.snapshot.startDeepLink) ?? URL(string: "whenbee://")!) {
                    Text("Start")
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 5)
                        .background(.tint, in: Capsule())
                        .foregroundStyle(.white)
                }
                .padding(.top, 2)
            } else {
                // No-task state — quiet, never guilt-y (product invariant).
                Text("Nothing queued")
                    .font(.headline)
                Text("Add a task to see its honest finish")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(14)
    }
}

struct NextTaskWidget: Widget {
    let kind = "WhenbeeNextTaskWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NextTaskProvider()) { entry in
            NextTaskWidgetView(entry: entry)
                .containerBackground(.background, for: .widget)
        }
        .configurationDisplayName("Next task")
        .description("Your next task and its honest finish time.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
