// FinishTimeAttributes.swift
// Main-app copy of the Live Activity attributes. MUST stay identical to the
// copy in targets/widget/FinishTimeActivity.swift.
import ActivityKit
import Foundation

struct FinishTimeAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var isOverrun: Bool
    }
    var taskLabel: String
    var finishEpoch: Double
    var finishDate: Date { Date(timeIntervalSince1970: finishEpoch) }
}
