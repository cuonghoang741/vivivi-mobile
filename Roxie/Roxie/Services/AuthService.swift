import Foundation

protocol AuthServicing: Sendable {
    func restoreSession() async -> User?
    func signInWithApple() async throws -> User
    func signOut() async
}

/// Phase 0 stub. Phase 1 will back this with Supabase + ASAuthorizationAppleIDProvider.
actor AuthService: AuthServicing {
    private let defaults = UserDefaults.standard
    private let userKey = "roxie.currentUser"

    func restoreSession() async -> User? {
        guard let data = defaults.data(forKey: userKey) else { return nil }
        return try? JSONDecoder().decode(User.self, from: data)
    }

    func signInWithApple() async throws -> User {
        let user = User(
            id: UUID().uuidString,
            email: nil,
            displayName: "Guest",
            avatarURL: nil,
            hasCompletedOnboarding: false,
            rubies: 0,
            isPro: false
        )
        if let data = try? JSONEncoder().encode(user) {
            defaults.set(data, forKey: userKey)
        }
        return user
    }

    func signOut() async {
        defaults.removeObject(forKey: userKey)
    }
}
