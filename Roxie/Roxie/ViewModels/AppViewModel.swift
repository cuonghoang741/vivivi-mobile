import SwiftUI

@MainActor
final class AppViewModel: ObservableObject {
    enum Phase: Equatable {
        case launching
        case signedOut
        case onboarding
        case ready
    }

    @Published var phase: Phase = .launching
    @Published var currentUser: User?

    let auth: AuthServicing
    let analytics: AnalyticsServicing

    init(
        auth: AuthServicing = AuthService(),
        analytics: AnalyticsServicing = AnalyticsService()
    ) {
        self.auth = auth
        self.analytics = analytics
    }

    func bootstrap() async {
        analytics.track(event: "app_launch")
        if let user = await auth.restoreSession() {
            currentUser = user
            phase = user.hasCompletedOnboarding ? .ready : .onboarding
        } else {
            phase = .signedOut
        }
    }

    func signedIn(_ user: User) {
        currentUser = user
        phase = user.hasCompletedOnboarding ? .ready : .onboarding
    }

    func finishedOnboarding() {
        currentUser?.hasCompletedOnboarding = true
        phase = .ready
    }

    func signOut() async {
        await auth.signOut()
        currentUser = nil
        phase = .signedOut
    }
}
