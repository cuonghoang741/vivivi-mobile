import SwiftUI

@MainActor
final class OnboardingViewModel: ObservableObject {
    struct Page: Identifiable, Hashable {
        let id = UUID()
        let title: String
        let body: String
        let symbol: String
    }

    @Published var step = 0
    let pages: [Page] = [
        Page(title: "Meet your companion",
             body: "Chat, hang out, and grow a relationship with your AI friend.",
             symbol: "heart.fill"),
        Page(title: "Talk out loud",
             body: "Real-time voice calls with natural conversation.",
             symbol: "mic.fill"),
        Page(title: "Personalize everything",
             body: "Pick looks, outfits, and personality.",
             symbol: "paintpalette.fill")
    ]

    var isLastStep: Bool { step == pages.count - 1 }
    var ctaLabel: String { isLastStep ? "Get started" : "Next" }

    func advance(onFinish: () -> Void) {
        if isLastStep {
            onFinish()
        } else {
            step += 1
        }
    }
}
