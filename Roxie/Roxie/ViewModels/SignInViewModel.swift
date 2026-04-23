import SwiftUI

@MainActor
final class SignInViewModel: ObservableObject {
    @Published var isSigningIn = false
    @Published var errorMessage: String?

    func signInWithApple() async -> User? {
        isSigningIn = true
        defer { isSigningIn = false }
        do {
            return try await AuthManager.shared.signInWithApple()
        } catch AuthError.canceled {
            return nil
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    /// Local-only guest. Identity is the anonymous `ClientID`, queries filter by `client_id`.
    func signInAsGuest() async -> User? {
        isSigningIn = true
        defer { isSigningIn = false }
        return User(
            id: ClientID.current(),
            email: nil,
            displayName: "Guest",
            avatarURL: nil,
            hasCompletedOnboarding: UserPreferencesService.shared.hasCompletedOnboardingV2,
            isPro: false
        )
    }
}
