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

    func bootstrap() async {
        if let user = await AuthManager.shared.restoreSession() {
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
        UserPreferencesService.shared.hasCompletedOnboardingV2 = true
        phase = .ready
    }

    func signOut() async {
        await AuthManager.shared.signOut()
        currentUser = nil
        phase = .signedOut
    }
}
