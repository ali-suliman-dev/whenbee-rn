import ExpoModulesCore
import WidgetKit
#if canImport(ActivityKit)
import ActivityKit
#endif

private let kAppGroupId = "group.com.whenbee.app"
private let kSnapshotKey = "whenbee.widgetSnapshot"

public class WhenbeePresenceModule: Module {
    // Retained so updateLiveActivity can read the previous isProRich value.
    #if canImport(ActivityKit)
    @available(iOS 16.2, *)
    private static var currentActivity: Activity<FinishTimeAttributes>?
    #endif

    public func definition() -> ModuleDefinition {
        Name("WhenbeePresence")

        // NOTE: The JS bridge derives `isStub` from whether requireOptionalNativeModule
        // returns nil. No `isStub` property is needed here — the module's mere presence
        // flips the bridge off the stub path.

        // Serialize the snapshot dict to JSON and write to the shared App Group
        // UserDefaults, then reload all widget timelines.
        Function("writeSnapshot") { (snapshot: [String: Any]) in
            guard
                let defaults = UserDefaults(suiteName: kAppGroupId),
                let data = try? JSONSerialization.data(withJSONObject: snapshot),
                let json = String(data: data, encoding: .utf8)
            else { return }
            defaults.set(json, forKey: kSnapshotKey)
            WidgetCenter.shared.reloadAllTimelines()
        }

        // Remove the snapshot from shared storage and reload all timelines.
        Function("clearSnapshot") {
            UserDefaults(suiteName: kAppGroupId)?.removeObject(forKey: kSnapshotKey)
            WidgetCenter.shared.reloadAllTimelines()
        }

        // Start a Live Activity for a running timer session.
        // Expects: { taskLabel: String, finishEpoch: Double, startEpoch: Double, isProRich?: Bool }
        Function("startLiveActivity") { (attrs: [String: Any]) in
            if #available(iOS 16.2, *) {
                self.startActivity(attrs)
            }
        }

        // Update the overrun state on the running Live Activity.
        // Expects: { isOverrun: Bool }
        Function("updateLiveActivity") { (state: [String: Any]) in
            if #available(iOS 16.2, *) {
                self.updateActivity(state)
            }
        }

        // End and dismiss the Live Activity immediately.
        Function("endLiveActivity") {
            if #available(iOS 16.2, *) {
                self.endActivity()
            }
        }
    }

    #if canImport(ActivityKit)
    @available(iOS 16.2, *)
    private func startActivity(_ attrs: [String: Any]) {
        // Tear down any lingering activities before starting a new one.
        for existing in Activity<FinishTimeAttributes>.activities {
            Task { await existing.end(nil, dismissalPolicy: .immediate) }
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        guard
            let label = attrs["taskLabel"] as? String,
            let finish = attrs["finishEpoch"] as? Double,
            let start = attrs["startEpoch"] as? Double
        else { return }
        let isProRich = (attrs["isProRich"] as? Bool) ?? false
        let attributes = FinishTimeAttributes(taskLabel: label, finishEpoch: finish, startEpoch: start)
        let initialState = FinishTimeAttributes.ContentState(isOverrun: false, isProRich: isProRich)
        let content = ActivityContent(state: initialState, staleDate: nil)
        Task {
            Self.currentActivity = try? Activity.request(
                attributes: attributes,
                content: content,
                pushType: nil
            )
        }
    }

    @available(iOS 16.2, *)
    private func updateActivity(_ state: [String: Any]) {
        let isOverrun = (state["isOverrun"] as? Bool) ?? false
        Task {
            guard let activity = Self.currentActivity else { return }
            // Preserve the isProRich flag set at activity start — it survives updates.
            let prevRich = activity.content.state.isProRich
            let newState = FinishTimeAttributes.ContentState(isOverrun: isOverrun, isProRich: prevRich)
            await activity.update(ActivityContent(state: newState, staleDate: nil))
        }
    }

    @available(iOS 16.2, *)
    private func endActivity() {
        Task {
            await Self.currentActivity?.end(nil, dismissalPolicy: .immediate)
            Self.currentActivity = nil
        }
    }
    #endif
}
