import Foundation
import AuthenticationServices
import Supabase
import CryptoKit
import UIKit

/// Phase 1 AuthManager. Mirrors RN's `AuthManager.ts`: a singleton that owns
/// Supabase session state, exposes async sign-in / restore / sign-out, and
/// publishes the current user to observers.
@MainActor
final class AuthManager: ObservableObject {
    static let shared = AuthManager()

    @Published private(set) var currentUser: User?
    @Published private(set) var isRestoring = false

    private let client = SupabaseClientFactory.shared
    private var sessionTask: Task<Void, Never>?

    private init() {
        sessionTask = Task { [weak self] in
            guard let self else { return }
            for await change in client.auth.authStateChanges {
                await handle(event: change.event, session: change.session)
            }
        }
    }

    deinit {
        sessionTask?.cancel()
    }

    /// Restore a persisted session on app launch.
    func restoreSession() async -> User? {
        isRestoring = true
        defer { isRestoring = false }
        if let session = try? await client.auth.session {
            return await hydrate(from: session)
        }
        return nil
    }

    func signInWithApple() async throws -> User {
        let nonce = Self.randomNonce()
        let hashedNonce = Self.sha256(nonce)

        let coordinator = AppleSignInCoordinator(nonce: hashedNonce)
        let auth = try await coordinator.signIn()

        guard
            let credential = auth.credential as? ASAuthorizationAppleIDCredential,
            let tokenData = credential.identityToken,
            let idToken = String(data: tokenData, encoding: .utf8)
        else {
            throw AuthError.appleMissingIdentityToken
        }

        do {
            let session = try await client.auth.signInWithIdToken(
                credentials: .init(provider: .apple, idToken: idToken, nonce: nonce)
            )
            return await hydrate(from: session)
        } catch {
            throw AuthError.supabaseExchange(error.localizedDescription)
        }
    }

    func signOut() async {
        try? await client.auth.signOut()
        currentUser = nil
    }

    // MARK: - Private

    private func handle(event: AuthChangeEvent, session: Session?) async {
        switch event {
        case .signedIn, .tokenRefreshed, .userUpdated, .initialSession:
            if let session {
                _ = await hydrate(from: session)
            }
        case .signedOut:
            currentUser = nil
        default:
            break
        }
    }

    @discardableResult
    private func hydrate(from session: Session) async -> User {
        let supabaseUser = session.user
        let user = User(
            id: supabaseUser.id.uuidString.lowercased(),
            email: supabaseUser.email,
            displayName: supabaseUser.userMetadata["full_name"]?.stringValue
                ?? supabaseUser.email,
            avatarURL: (supabaseUser.userMetadata["avatar_url"]?.stringValue).flatMap(URL.init),
            hasCompletedOnboarding: UserPreferencesService.shared.hasCompletedOnboardingV2,
            isPro: false // Phase 7 fills in real subscription state.
        )
        currentUser = user
        return user
    }

    private static func randomNonce(length: Int = 32) -> String {
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._")
        return String((0..<length).map { _ in
            charset[Int(UInt8.random(in: 0...UInt8.max)) % charset.count]
        })
    }

    private static func sha256(_ input: String) -> String {
        let hashed = SHA256.hash(data: Data(input.utf8))
        return hashed.compactMap { String(format: "%02x", $0) }.joined()
    }
}
