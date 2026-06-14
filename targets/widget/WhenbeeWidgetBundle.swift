// WhenbeeWidgetBundle.swift
//
// Entry point for the widget extension. Registers both surfaces in one bundle:
//   • NextTaskWidget          — static Home-screen widget
//   • FinishTimeActivityWidget — ActivityKit Live Activity / Dynamic Island
//
// This is why the Live Activity lives in the widget target rather than its own:
// iOS requires Live Activities to ship inside a WidgetKit extension bundle.

import WidgetKit
import SwiftUI

@main
struct WhenbeeWidgetBundle: WidgetBundle {
    var body: some Widget {
        NextTaskWidget()
        FinishTimeActivityWidget()
    }
}
