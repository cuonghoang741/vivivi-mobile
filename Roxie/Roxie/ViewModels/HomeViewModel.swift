import SwiftUI

@MainActor
final class HomeViewModel: ObservableObject {
    @Published var showSettings = false
    @Published var isChatOpen = false
    @Published var isCallActive = false

    private let analytics: AnalyticsServicing

    init(analytics: AnalyticsServicing = AnalyticsService()) {
        self.analytics = analytics
    }

    func tapChat() {
        analytics.track(event: "home_tap_chat")
        isChatOpen = true
    }

    func tapCall() {
        analytics.track(event: "home_tap_call")
        isCallActive = true // Phase 5 wires LiveKit here.
    }

    func tapGift() {
        analytics.track(event: "home_tap_gift")
    }

    func openSettings() {
        analytics.track(event: "home_open_settings")
        showSettings = true
    }
}
