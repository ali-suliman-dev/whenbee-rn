import ExpoModulesCore
import WidgetKit
#if canImport(ActivityKit)
import ActivityKit
#endif

private let kAppGroupId = "group.com.whenbee.app"
private let kSnapshotKey = "whenbee.widgetSnapshot"

struct WidgetSnapshotRecord: Record {
    @Field var nextTaskLabel: String = ""
    @Field var category: String = ""
    @Field var honestFinishClock: String = ""
    @Field var startDeepLink: String = ""
    @Field var updatedAtEpoch: Double = 0
}
struct LiveActivityAttributesRecord: Record {
    @Field var taskLabel: String = ""
    @Field var finishEpoch: Double = 0
}
struct LiveActivityUpdateRecord: Record {
    @Field var isOverrun: Bool = false
}

public class WhenbeePresenceModule: Module {
    public func definition() -> ModuleDefinition {
        Name("WhenbeePresence")
        Property("isStub") { false }

        Function("writeSnapshot") { (snapshot: WidgetSnapshotRecord) in
            guard let defaults = UserDefaults(suiteName: kAppGroupId) else { return }
            let payload: [String: Any] = [
                "nextTaskLabel": snapshot.nextTaskLabel,
                "category": snapshot.category,
                "honestFinishClock": snapshot.honestFinishClock,
                "startDeepLink": snapshot.startDeepLink,
                "updatedAtEpoch": snapshot.updatedAtEpoch,
            ]
            guard
                let data = try? JSONSerialization.data(withJSONObject: payload),
                let json = String(data: data, encoding: .utf8)
            else { return }
            defaults.set(json, forKey: kSnapshotKey)
            WidgetCenter.shared.reloadAllTimelines()
        }
        Function("clearSnapshot") {
            guard let defaults = UserDefaults(suiteName: kAppGroupId) else { return }
            defaults.removeObject(forKey: kSnapshotKey)
            WidgetCenter.shared.reloadAllTimelines()
        }
        Function("startLiveActivity") { (attributes: LiveActivityAttributesRecord) in
            if #available(iOS 16.2, *) { self.startActivity(attributes) }
        }
        Function("updateLiveActivity") { (state: LiveActivityUpdateRecord) in
            if #available(iOS 16.2, *) { self.updateActivity(isOverrun: state.isOverrun) }
        }
        Function("endLiveActivity") {
            if #available(iOS 16.2, *) { self.endActivity() }
        }
    }

    #if canImport(ActivityKit)
    @available(iOS 16.2, *)
    private func startActivity(_ attributes: LiveActivityAttributesRecord) {
        for activity in Activity<FinishTimeAttributes>.activities {
            Task { await activity.end(nil, dismissalPolicy: .immediate) }
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        let attrs = FinishTimeAttributes(taskLabel: attributes.taskLabel, finishEpoch: attributes.finishEpoch)
        let initialState = FinishTimeAttributes.ContentState(isOverrun: false)
        let content = ActivityContent(state: initialState, staleDate: Date(timeIntervalSince1970: attributes.finishEpoch))
        _ = try? Activity.request(attributes: attrs, content: content, pushType: nil)
    }
    @available(iOS 16.2, *)
    private func updateActivity(isOverrun: Bool) {
        let newState = FinishTimeAttributes.ContentState(isOverrun: isOverrun)
        let content = ActivityContent(state: newState, staleDate: nil)
        for activity in Activity<FinishTimeAttributes>.activities { Task { await activity.update(content) } }
    }
    @available(iOS 16.2, *)
    private func endActivity() {
        let finalState = FinishTimeAttributes.ContentState(isOverrun: false)
        let content = ActivityContent(state: finalState, staleDate: nil)
        for activity in Activity<FinishTimeAttributes>.activities { Task { await activity.end(content, dismissalPolicy: .immediate) } }
    }
    #endif
}
